import { NextRequest, NextResponse } from 'next/server'
import { Prisma, PaymentMethod } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { capturePayment, createPaymentIntent } from '@/lib/payments'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { formatDateTime } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const payOrderSchema = z.object({
  paymentMethod: z.enum(['PAYPAL', 'INVOICE']).optional(),
  simulateFailure: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const user = await requireAuth()

    const body = await request.json().catch(() => ({}))
    const parsed = payOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const input = parsed.data

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            locationType: true,
            venue: true,
            city: true,
            country: true,
            onlineUrl: true,
          },
        },
        items: {
          include: {
            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (order.status === 'PAID') {
      return NextResponse.json({ message: 'Order is already paid' })
    }

    if (order.status !== 'PENDING' && order.status !== 'PENDING_INVOICE') {
      return NextResponse.json(
        { error: `Order cannot be paid in status ${order.status}` },
        { status: 409 }
      )
    }

    const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))

    if (input.simulateFailure) {
      await prisma.$transaction(
        async (tx) => {
          await lockTicketTypes(tx, ticketTypeIds)

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

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )

      return NextResponse.json(
        {
          error: 'Payment failed, reservation released',
        },
        { status: 402 }
      )
    }

    const paymentIntent = await createPaymentIntent({
      amount: Number(order.totalAmount),
      currency: order.currency,
      orderId: order.id,
      description: `OpenEvents Order ${order.orderNumber}`,
    })

    const paymentResult = await capturePayment(paymentIntent.id)

    if (paymentResult.status !== 'completed') {
      await prisma.$transaction(
        async (tx) => {
          await lockTicketTypes(tx, ticketTypeIds)

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

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )

      return NextResponse.json(
        {
          error: 'Payment failed, reservation released',
        },
        { status: 402 }
      )
    }

    const paidOrder = await prisma.$transaction(
      async (tx) => {
        await lockTicketTypes(tx, ticketTypeIds)

        const latestOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            items: {
              include: {
                ticketType: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            event: {
              select: {
                title: true,
                startDate: true,
                locationType: true,
                venue: true,
                city: true,
                country: true,
                onlineUrl: true,
              },
            },
          },
        })

        if (latestOrder.status !== 'PENDING' && latestOrder.status !== 'PENDING_INVOICE') {
          throw new Error(`Order cannot be paid in status ${latestOrder.status}`)
        }

        for (const item of latestOrder.items) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              reservedCount: {
                decrement: item.quantity,
              },
              soldCount: {
                increment: item.quantity,
              },
            },
          })
        }

        await tx.order.update({
          where: { id: latestOrder.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentId: paymentIntent.id,
            paymentMethod:
              input.paymentMethod ??
              (latestOrder.paymentMethod === 'INVOICE' ? PaymentMethod.INVOICE : PaymentMethod.PAYPAL),
          },
        })

        const ticketCreateData = generateTicketCreateInput(
          latestOrder.id,
          latestOrder.items.map((item) => ({
            ticketTypeId: item.ticketTypeId,
            ticketTypeName: item.ticketType.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            currency: latestOrder.currency,
          }))
        )

        if (ticketCreateData.length > 0) {
          await tx.ticket.createMany({
            data: ticketCreateData,
          })
        }

        return tx.order.findUniqueOrThrow({
          where: { id: latestOrder.id },
          include: {
            items: {
              include: {
                ticketType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            tickets: true,
            event: {
              select: {
                title: true,
                startDate: true,
                locationType: true,
                venue: true,
                city: true,
                country: true,
                onlineUrl: true,
              },
            },
          },
        })
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    await sendOrderConfirmationEmail(paidOrder.buyerEmail, {
      orderNumber: paidOrder.orderNumber,
      eventTitle: paidOrder.event.title,
      eventDate: formatDateTime(paidOrder.event.startDate),
      eventLocation:
        paidOrder.event.locationType === 'ONLINE'
          ? paidOrder.event.onlineUrl || 'Online event'
          : [paidOrder.event.venue, paidOrder.event.city, paidOrder.event.country]
              .filter(Boolean)
              .join(', '),
      tickets: paidOrder.items.map((item) => ({
        name: item.ticketType.name,
        quantity: item.quantity,
        price: `${item.totalPrice.toString()} ${paidOrder.currency}`,
      })),
      totalAmount: `${paidOrder.totalAmount.toString()} ${paidOrder.currency}`,
      buyerName: `${paidOrder.buyerFirstName} ${paidOrder.buyerLastName}`,
    })

    return NextResponse.json({
      order: paidOrder,
      payment: {
        paymentId: paymentIntent.id,
        status: paymentResult.status,
      },
      message: 'Payment completed successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.startsWith('Order cannot be paid in status')) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }

    console.error('Failed to process payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
