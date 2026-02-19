import { NextRequest, NextResponse } from 'next/server'
import { Prisma, PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail, sendEmail } from '@/lib/email'
import { verifyPayPalWebhook, type PayPalWebhookEvent } from '@/lib/payments/paypal'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { formatDateTime } from '@/lib/utils'

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID

/**
 * PayPal Webhook Handler
 *
 * Handles the following event types:
 * - PAYMENT.CAPTURE.COMPLETED: Payment was successfully captured
 * - PAYMENT.CAPTURE.DENIED: Payment capture was denied
 * - PAYMENT.CAPTURE.REFUNDED: Payment was refunded
 * - CHECKOUT.ORDER.APPROVED: Order was approved by the payer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    let event: PayPalWebhookEvent

    try {
      event = JSON.parse(body)
    } catch {
      console.error('[Webhook] Invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Verify webhook signature in production
    if (PAYPAL_WEBHOOK_ID && process.env.NODE_ENV === 'production') {
      const headers: Record<string, string> = {}
      request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
      })

      const isValid = await verifyPayPalWebhook(headers, body, PAYPAL_WEBHOOK_ID)

      if (!isValid) {
        console.error('[Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    console.log('[Webhook] Received event:', {
      id: event.id,
      type: event.event_type,
      resourceType: event.resource_type,
    })

    // Handle different event types
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handleCaptureCompleted(event)
        break

      case 'PAYMENT.CAPTURE.DENIED':
        await handleCaptureDenied(event)
        break

      case 'PAYMENT.CAPTURE.REFUNDED':
        await handleCaptureRefunded(event)
        break

      case 'CHECKOUT.ORDER.APPROVED':
        // Order approved but not yet captured
        // We handle capture in the return URL, so just log this
        console.log('[Webhook] Order approved:', event.resource)
        break

      default:
        console.log('[Webhook] Unhandled event type:', event.event_type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)
    // Return 200 to prevent PayPal from retrying
    // Log the error for investigation
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}

/**
 * Handle successful payment capture
 */
async function handleCaptureCompleted(event: PayPalWebhookEvent) {
  const resource = event.resource as {
    id: string
    supplementary_data?: {
      related_ids?: {
        order_id?: string
      }
    }
    amount?: {
      value: string
      currency_code: string
    }
  }

  const captureId = resource.id
  const paypalOrderId = resource.supplementary_data?.related_ids?.order_id

  console.log('[Webhook] Capture completed:', { captureId, paypalOrderId })

  // Find order by PayPal order ID
  const order = await prisma.order.findFirst({
    where: {
      paymentId: paypalOrderId || captureId,
    },
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

  if (!order) {
    console.log('[Webhook] Order not found for capture:', captureId)
    return
  }

  // If already paid, skip
  if (order.status === 'PAID') {
    console.log('[Webhook] Order already paid:', order.orderNumber)
    return
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

      if (latestOrder.status === 'PAID') {
        return latestOrder
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
          paymentId: captureId,
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

  console.log('[Webhook] Order completed via webhook:', paidOrder.orderNumber)
}

/**
 * Handle denied payment capture
 */
async function handleCaptureDenied(event: PayPalWebhookEvent) {
  const resource = event.resource as {
    id: string
    supplementary_data?: {
      related_ids?: {
        order_id?: string
      }
    }
  }

  const captureId = resource.id
  const paypalOrderId = resource.supplementary_data?.related_ids?.order_id

  console.log('[Webhook] Capture denied:', { captureId, paypalOrderId })

  const order = await prisma.order.findFirst({
    where: {
      paymentId: paypalOrderId || captureId,
    },
    include: {
      items: true,
    },
  })

  if (!order || order.status !== 'PENDING') {
    return
  }

  // Cancel the order and release reserved tickets
  const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))

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
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )

  console.log('[Webhook] Order cancelled due to denied capture:', order.orderNumber)
}

/**
 * Handle refunded payment
 */
async function handleCaptureRefunded(event: PayPalWebhookEvent) {
  const resource = event.resource as {
    id: string
    amount?: {
      value: string
      currency_code: string
    }
  }

  const refundId = resource.id

  console.log('[Webhook] Capture refunded:', refundId)

  // Find order by payment ID (capture ID)
  // Note: We'd need to store the capture ID separately to match this properly
  // For now, we'll update any order that has a pending refund
  const order = await prisma.order.findFirst({
    where: {
      refundStatus: 'PENDING',
    },
  })

  if (order) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'REFUNDED',
        refundStatus: 'PROCESSED',
        refundedAt: new Date(),
      },
    })

    // Notify buyer
    await sendEmail({
      to: order.buyerEmail,
      subject: `Refund completed for order #${order.orderNumber}`,
      html: `
        <p>Hi ${order.buyerFirstName},</p>
        <p>Your refund for order #${order.orderNumber} has been processed.</p>
        <p>The funds should appear in your PayPal account within a few business days.</p>
      `,
      text: `Your refund for order #${order.orderNumber} has been processed.`,
    })

    console.log('[Webhook] Order refund completed:', order.orderNumber)
  }
}
