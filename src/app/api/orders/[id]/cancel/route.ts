import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessOrder } from '@/lib/orders/authorization'
import { lockTicketTypes } from '@/lib/orders'
import { getDiscountUsageUnitsFromItems, releaseDiscountCodeUsage } from '@/lib/orders/discountUsage'
import { isCancellationDeadlinePassed } from '@/lib/utils'
import { getAppUrl } from '@/lib/url'

interface RouteContext {
  params: Promise<{ id: string }>
}

const cancelOrderInputSchema = z.object({
  reason: z.string().optional(),
})

/**
 * Handle checkout cancellation redirect from payment provider.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params

    // Find the order first (before auth check) so we can redirect properly on session expiry
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            slug: true,
            organizer: {
              select: {
                userId: true,
              },
            },
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
      return NextResponse.redirect(`${getAppUrl()}?error=order_not_found`)
    }

    // Check authentication - if session expired, still redirect to checkout with cancel notice
    const user = await getCurrentUser()
    if (!user) {
      // Session expired - redirect to checkout with session_expired flag
      // The checkout page will prompt login but won't lose the context
      return NextResponse.redirect(
        `${getAppUrl()}/events/${order.event.slug}/checkout?cancelled=true&session_expired=true`
      )
    }

    const authorized = canAccessOrder({
      orderUserId: order.userId,
      organizerUserId: order.event.organizer.userId,
      requesterUserId: user.id,
      requesterRoles: user.roles,
    })
    if (!authorized) {
      return NextResponse.redirect(`${getAppUrl()}/checkout-error?error=forbidden`)
    }

    // If already paid or cancelled, redirect appropriately
    if (order.status === 'PAID') {
      return NextResponse.redirect(`${getAppUrl()}/orders/${order.orderNumber}`)
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.redirect(
        `${getAppUrl()}/events/${order.event.slug}/checkout?cancelled=true`
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

          if (order.discountCodeId) {
            const usageUnits = getDiscountUsageUnitsFromItems(order.items)
            await releaseDiscountCodeUsage(tx, order.discountCodeId, usageUnits)
          }

          // Mark order as cancelled
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              expiresAt: null,
            },
          })
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      )

      console.log('[Payment Cancel] Order cancelled:', order.orderNumber)
    }

    // Redirect back to checkout page with cancellation message
    return NextResponse.redirect(
      `${getAppUrl()}/events/${order.event.slug}/checkout?cancelled=true`
    )
  } catch (error) {
    console.error('[Payment Cancel] Failed to cancel order:', error)
    return NextResponse.redirect(`${getAppUrl()}?error=cancel_failed`)
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

    const canManageOrder = canAccessOrder({
      orderUserId: order.userId,
      organizerUserId: order.event.organizer.userId,
      requesterUserId: user.id,
      requesterRoles: user.roles,
    })
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
          const usageUnits = getDiscountUsageUnitsFromItems(order.items)
          await releaseDiscountCodeUsage(tx, order.discountCodeId, usageUnits)
        }

        return tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            expiresAt: null,
            refundStatus: order.status === 'PAID' ? 'PENDING' : null,
            refundReason: parsed.data.reason,
          },
        })
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

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
