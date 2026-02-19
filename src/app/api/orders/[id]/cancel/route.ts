import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lockTicketTypes } from '@/lib/orders'
import { isCancellationDeadlinePassed } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const cancelOrderInputSchema = z.object({
  reason: z.string().optional(),
})

/**
 * Handle PayPal cancellation redirect
 * PayPal redirects here when user cancels the payment
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            slug: true,
          },
        },
        items: {
          select: {
            ticketTypeId: true,
            quantity: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.redirect(`${APP_URL}?error=order_not_found`)
    }

    // If already paid or cancelled, redirect appropriately
    if (order.status === 'PAID') {
      return NextResponse.redirect(`${APP_URL}/orders/${order.orderNumber}/confirmation`)
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.redirect(
        `${APP_URL}/events/${order.event.slug}/checkout?cancelled=true`
      )
    }

    // Cancel the order and release reserved tickets
    if (order.status === 'PENDING' || order.status === 'PENDING_INVOICE') {
      const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))

      await prisma.$transaction(
        async (tx) => {
          await lockTicketTypes(tx, ticketTypeIds)

          // Release reserved tickets
          for (const item of order.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: {
                reservedCount: {
                  decrement: item.quantity,
                },
              },
            })
          }

          // Mark order as cancelled
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          })
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      )

      console.log('[PayPal Cancel] Order cancelled:', order.orderNumber)
    }

    // Redirect back to checkout page with cancellation message
    return NextResponse.redirect(
      `${APP_URL}/events/${order.event.slug}/checkout?cancelled=true`
    )
  } catch (error) {
    console.error('[PayPal Cancel] Failed to cancel order:', error)
    return NextResponse.redirect(`${APP_URL}?error=cancel_failed`)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const user = await requireAuth()

    const body = await request.json().catch(() => ({}))
    const parsed = cancelOrderInputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            id: true,
            startDate: true,
            cancellationDeadlineHours: true,
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
        items: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const canManageOrder = order.userId === user.id || order.event.organizer.userId === user.id
    if (!canManageOrder) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      return NextResponse.json(
        { error: `Order is already ${order.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    if (isCancellationDeadlinePassed(order.event.startDate, order.event.cancellationDeadlineHours)) {
      return NextResponse.json(
        { error: 'Cancellation deadline has passed' },
        { status: 409 }
      )
    }

    const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))

    const cancelledOrder = await prisma.$transaction(
      async (tx) => {
        await lockTicketTypes(tx, ticketTypeIds)

        if (order.status === 'PAID') {
          for (const item of order.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: {
                soldCount: {
                  decrement: item.quantity,
                },
              },
            })
          }

          await tx.ticket.updateMany({
            where: {
              orderId: order.id,
              status: 'ACTIVE',
            },
            data: {
              status: 'CANCELLED',
            },
          })
        } else if (order.status === 'PENDING' || order.status === 'PENDING_INVOICE') {
          for (const item of order.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: {
                reservedCount: {
                  decrement: item.quantity,
                },
              },
            })
          }
        }

        if (order.discountCodeId) {
          await tx.discountCode.updateMany({
            where: {
              id: order.discountCodeId,
              usedCount: {
                gt: 0,
              },
            },
            data: {
              usedCount: {
                decrement: 1,
              },
            },
          })
        }

        return tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            refundStatus: order.status === 'PAID' ? 'PENDING' : null,
            refundReason: parsed.data.reason,
          },
        })
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    return NextResponse.json({
      order: cancelledOrder,
      refundRequired: order.status === 'PAID',
      message:
        order.status === 'PAID'
          ? 'Order cancelled and flagged for refund'
          : 'Order cancelled successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Failed to cancel order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
