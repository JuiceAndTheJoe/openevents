import { NextRequest, NextResponse } from 'next/server'
import { Prisma, PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { capturePayment, getPaymentStatus } from '@/lib/payments'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { formatDateTime } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Handle PayPal return after user approval
 * PayPal redirects here with ?token=PAYPAL_ORDER_ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const { searchParams } = new URL(request.url)
    const paypalToken = searchParams.get('token')

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
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
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=order_not_found`)
    }

    // Verify the PayPal token matches
    if (paypalToken && order.paymentId !== paypalToken) {
      console.error('[Capture] Token mismatch:', { expected: order.paymentId, received: paypalToken })
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=invalid_token`)
    }

    // Check if already paid
    if (order.status === 'PAID') {
      return NextResponse.redirect(`${APP_URL}/orders/${order.orderNumber}/confirmation`)
    }

    // Check if order can be paid
    if (order.status !== 'PENDING' && order.status !== 'PENDING_INVOICE') {
      return NextResponse.redirect(
        `${APP_URL}/checkout-error?error=invalid_status&status=${order.status}`
      )
    }

    const paypalOrderId = paypalToken || order.paymentId

    if (!paypalOrderId) {
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=no_payment_id`)
    }

    // Verify the order is approved
    const paymentStatus = await getPaymentStatus(paypalOrderId)

    if (!paymentStatus.isApproved) {
      console.error('[Capture] Order not approved:', paymentStatus)
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=not_approved`)
    }

    // Capture the payment
    const captureResult = await capturePayment(paypalOrderId)

    if (captureResult.status !== 'completed') {
      console.error('[Capture] Payment capture failed:', captureResult)
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=capture_failed`)
    }

    // Complete the order in database
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

        // Double-check status in case of race condition
        if (latestOrder.status === 'PAID') {
          return latestOrder
        }

        if (latestOrder.status !== 'PENDING' && latestOrder.status !== 'PENDING_INVOICE') {
          throw new Error(`Order cannot be paid in status ${latestOrder.status}`)
        }

        // Update ticket counts
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

        // Mark order as paid
        await tx.order.update({
          where: { id: latestOrder.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentId: captureResult.captureId,
            paymentMethod: PaymentMethod.PAYPAL,
          },
        })

        // Generate tickets
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

    // Send confirmation email
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

    // Redirect to confirmation page
    return NextResponse.redirect(`${APP_URL}/orders/${paidOrder.orderNumber}/confirmation`)
  } catch (error) {
    console.error('[Capture] Failed to capture payment:', error)
    return NextResponse.redirect(`${APP_URL}/checkout-error?error=capture_exception`)
  }
}
