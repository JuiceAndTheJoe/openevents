import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma, PaymentMethod } from '@prisma/client'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { canAccessOrder } from '@/lib/orders/authorization'
import {
  createPaymentIntent,
  capturePayment,
  generatePaymentUrls,
  isPaymentProviderConfigured,
} from '@/lib/payments'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { expirePendingOrderIfNeeded } from '@/lib/orders/expirePendingOrder'
import { formatDateTime } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const payOrderSchema = z.object({
  paymentMethod: z.enum(['PAYPAL', 'INVOICE']).optional(),
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const session = await getSession()
    const user = session?.user || null

    const body = await request.json().catch(() => ({}))
    if (process.env.NODE_ENV === 'development') {
      console.log('[Pay] Processing order:', orderId)
    }
    const parsed = payOrderSchema.safeParse(body)

    if (!parsed.success) {
      console.log('[Pay] Validation error:', parsed.error.flatten())
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
            organizer: {
              select: {
                userId: true,
              },
            },
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

    // For anonymous orders (no userId), allow access
    // For orders with userId, verify the requester can access
    const isAnonymousOrder = !order.userId
    const canManageOrder = isAnonymousOrder || (user && canAccessOrder({
      orderUserId: order.userId,
      organizerUserId: order.event.organizer.userId,
      requesterUserId: user.id,
      requesterRoles: user.roles,
    }))
    if (!canManageOrder) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orderForResponse = {
      ...order,
      event: {
        id: order.event.id,
        title: order.event.title,
        startDate: order.event.startDate,
        locationType: order.event.locationType,
        venue: order.event.venue,
        city: order.event.city,
        country: order.event.country,
        onlineUrl: order.event.onlineUrl,
      },
    }

    if (order.status === 'PAID') {
      return NextResponse.json({ message: 'Order is already paid', order: orderForResponse })
    }

    if (order.status === 'PENDING' && order.expiresAt && order.expiresAt <= new Date()) {
      await expirePendingOrderIfNeeded(order.id)
      return NextResponse.json(
        { error: 'Order reservation has expired. Please start checkout again.' },
        { status: 409 }
      )
    }

    if (order.status !== 'PENDING' && order.status !== 'PENDING_INVOICE') {
      return NextResponse.json(
        { error: `Order cannot be paid in status ${order.status}` },
        { status: 409 }
      )
    }

    // Handle invoice payment method - no external payment needed
    if (input.paymentMethod === 'INVOICE' || order.paymentMethod === 'INVOICE') {
      // Ensure the order is in PENDING_INVOICE status
      if (order.status === 'PENDING') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PENDING_INVOICE',
            paymentMethod: PaymentMethod.INVOICE,
            expiresAt: null,
          },
        })
      }
      revalidateTag('event-analytics', 'max')
      revalidateTag('dashboard-analytics', 'max')
      // Invoice orders stay in PENDING_INVOICE status until manually marked as paid
      return NextResponse.json({
        order: orderForResponse,
        checkout: {
          type: 'invoice',
          message: 'Invoice order created. Payment will be processed manually.',
        },
      })
    }

    // Generate redirect URLs
    const { returnUrl, cancelUrl } = generatePaymentUrls(APP_URL, orderId)

    // Create Stripe checkout session
    const paymentIntent = await createPaymentIntent({
      amount: Number(order.totalAmount),
      currency: order.currency,
      orderId: order.id,
      description: `OpenEvents Order ${order.orderNumber}`,
      returnUrl,
      cancelUrl,
    })

    // Store payment session ID on our order for later capture
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentId: paymentIntent.id,
      },
    })

    // If payment provider is configured, return approval URL for redirect
    if (isPaymentProviderConfigured() && paymentIntent.approvalUrl) {
      return NextResponse.json({
        order: orderForResponse,
        checkout: {
          type: 'redirect',
          approvalUrl: paymentIntent.approvalUrl,
          paymentSessionId: paymentIntent.id,
        },
        message: 'Redirect to Stripe to complete payment',
      })
    }

    // Stub mode: auto-capture for development
    const captureResult = await capturePayment(paymentIntent.id)

    if (captureResult.status !== 'completed') {
      return NextResponse.json(
        { error: 'Payment capture failed' },
        { status: 402 }
      )
    }

    // Complete the order
    const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))

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
            expiresAt: null,
            paymentId: paymentIntent.id,
            paymentMethod: PaymentMethod.PAYPAL,
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

    // Email failures must not fail a successful payment flow.
    try {
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
        vatRate: parseFloat(paidOrder.vatRate.toString()),
        vatAmount: paidOrder.vatAmount.toString(),
        ticketCodes: paidOrder.tickets.map((t) => t.ticketCode),
      })
    } catch (emailError) {
      console.error('[Pay] Confirmation email failed after successful payment:', emailError)
    }

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

    return NextResponse.json({
      order: paidOrder,
      checkout: {
        type: 'completed',
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

      if (error.message === 'Stripe secret key not configured') {
        return NextResponse.json(
          { error: 'Payment service not configured' },
          { status: 503 }
        )
      }
    }

    console.error('Failed to process payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
