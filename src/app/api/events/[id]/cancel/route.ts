import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { sendEventCancellationEmail } from '@/lib/email'
import { lockTicketTypes } from '@/lib/orders'
import { getDiscountUsageUnitsFromItems, releaseDiscountCodeUsage } from '@/lib/orders/discountUsage'
import { isPaymentProviderConfigured, processRefund } from '@/lib/payments'
import { formatDateTime } from '@/lib/utils'

const cancelBodySchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      message,
      error: message,
      ...(extra ?? {}),
    },
    { status }
  )
}

function appendNote(existing: string | null, note: string) {
  return existing ? `${existing}\n${note}` : note
}

async function sendCancellationEmails(
  orders: Array<{
    buyerEmail: string
    buyerFirstName: string
    buyerLastName: string
    orderNumber: string
  }>,
  eventTitle: string,
  eventDate: string
) {
  const results = await Promise.allSettled(
    orders.map((order) =>
      sendEventCancellationEmail(order.buyerEmail, {
        eventTitle,
        eventDate,
        buyerName: `${order.buyerFirstName} ${order.buyerLastName}`.trim() || 'Attendee',
        orderNumber: order.orderNumber,
      })
    )
  )

  const failedCount = results.filter((result) => result.status === 'rejected').length
  if (failedCount > 0) {
    console.error(`Failed to send ${failedCount} cancellation emails`)
  }

  return {
    sentCount: results.length - failedCount,
    failedCount,
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(['ORGANIZER', 'SUPER_ADMIN'])
    const { id } = await context.params

    const body = await request.json().catch(() => ({}))
    const parsed = cancelBodySchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(
        'Cancellation reason is invalid. Keep it between 1 and 1000 characters.',
        400,
        { details: parsed.error.flatten().fieldErrors }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id },
    })

    if (!event) return errorResponse('Event not found.', 404)

    if (event.status === 'CANCELLED') {
      return errorResponse('Event is already cancelled.', 400)
    }

    if (event.status === 'COMPLETED') {
      return errorResponse('Completed events cannot be cancelled.', 400)
    }

    const cancelledAt = new Date()
    const refundReason = parsed.data.reason || 'Event cancelled by organizer'

    const { cancelledEvent, affectedOrders } = await prisma.$transaction(
      async (tx) => {
        const orders = await tx.order.findMany({
          where: {
            eventId: id,
            status: {
              in: ['PAID', 'PENDING_INVOICE', 'PENDING'],
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            paymentId: true,
            totalAmount: true,
            currency: true,
            discountCodeId: true,
            buyerEmail: true,
            buyerFirstName: true,
            buyerLastName: true,
            refundNotes: true,
            items: {
              select: {
                ticketTypeId: true,
                quantity: true,
              },
            },
          },
        })

        const ticketTypeIds = Array.from(
          new Set(orders.flatMap((order) => order.items.map((item) => item.ticketTypeId)))
        )

        await lockTicketTypes(tx, ticketTypeIds)

        const reservedReleases = new Map<string, number>()
        const soldReleases = new Map<string, number>()
        const paidOrderIds: string[] = []
        const pendingOrderIds: string[] = []
        const paidGatewayOrderIds: string[] = []

        for (const order of orders) {
          if (order.status === 'PAID') {
            paidOrderIds.push(order.id)
            if (order.paymentMethod === 'PAYPAL') {
              paidGatewayOrderIds.push(order.id)
            }
          } else {
            pendingOrderIds.push(order.id)
          }

          for (const item of order.items) {
            const target = order.status === 'PAID' ? soldReleases : reservedReleases
            target.set(item.ticketTypeId, (target.get(item.ticketTypeId) || 0) + item.quantity)
          }
        }

        for (const [ticketTypeId, quantity] of reservedReleases.entries()) {
          await tx.ticketType.update({
            where: { id: ticketTypeId },
            data: {
              reservedCount: {
                decrement: quantity,
              },
            },
          })
        }

        for (const [ticketTypeId, quantity] of soldReleases.entries()) {
          await tx.ticketType.update({
            where: { id: ticketTypeId },
            data: {
              soldCount: {
                decrement: quantity,
              },
            },
          })
        }

        if (paidOrderIds.length > 0) {
          await tx.ticket.updateMany({
            where: {
              orderId: {
                in: paidOrderIds,
              },
              status: 'ACTIVE',
            },
            data: {
              status: 'CANCELLED',
            },
          })
        }

        if (pendingOrderIds.length > 0) {
          await tx.order.updateMany({
            where: {
              id: {
                in: pendingOrderIds,
              },
            },
            data: {
              status: 'CANCELLED',
              cancelledAt,
              expiresAt: null,
            },
          })
        }

        if (paidOrderIds.length > 0) {
          await tx.order.updateMany({
            where: {
              id: {
                in: paidOrderIds,
              },
            },
            data: {
              status: 'CANCELLED',
              cancelledAt,
              expiresAt: null,
            },
          })
        }

        if (paidGatewayOrderIds.length > 0) {
          await tx.order.updateMany({
            where: {
              id: {
                in: paidGatewayOrderIds,
              },
            },
            data: {
              refundStatus: 'PENDING',
              refundReason,
            },
          })
        }

        for (const order of orders) {
          if (!order.discountCodeId) continue
          const usageUnits = getDiscountUsageUnitsFromItems(order.items)
          await releaseDiscountCodeUsage(tx, order.discountCodeId, usageUnits)
        }

        const cancelledEvent = await tx.event.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt,
            descriptionHtml: parsed.data.reason
              ? `${event.descriptionHtml || ''}\n\n<p><strong>Cancellation reason:</strong> ${parsed.data.reason}</p>`
              : event.descriptionHtml,
          },
        })

        return {
          cancelledEvent,
          affectedOrders: orders,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    const paymentProviderConfigured = isPaymentProviderConfigured()
    const refundableGatewayOrders = affectedOrders.filter(
      (order) => order.status === 'PAID' && order.paymentMethod === 'PAYPAL'
    )

    const refundResults = await Promise.all(
      refundableGatewayOrders.map(async (order) => {
        if (!order.paymentId) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              refundStatus: 'PENDING',
              refundReason,
              refundNotes: appendNote(
                order.refundNotes,
                `Event cancellation on ${cancelledAt.toISOString()}: missing payment reference, manual refund required.`
              ),
            },
          })

          return { status: 'failed' as const }
        }

        if (!paymentProviderConfigured) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              refundStatus: 'PENDING',
              refundReason,
              refundNotes: appendNote(
                order.refundNotes,
                `Event cancellation on ${cancelledAt.toISOString()}: Stripe is not configured, manual refund required.`
              ),
            },
          })

          return { status: 'pending' as const }
        }

        try {
          const refund = await processRefund({
            captureId: order.paymentId,
            amount: Number(order.totalAmount),
            currency: order.currency,
            reason: refundReason,
          })

          if (refund.status === 'completed') {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: 'REFUNDED',
                refundStatus: 'PROCESSED',
                refundReason,
                refundedAt: new Date(),
                refundNotes: appendNote(
                  order.refundNotes,
                  `Event cancellation refund processed via Stripe. Refund ID: ${refund.refundId}.`
                ),
              },
            })

            return { status: 'completed' as const }
          }

          await prisma.order.update({
            where: { id: order.id },
            data: {
              refundStatus: 'PENDING',
              refundReason,
              refundNotes: appendNote(
                order.refundNotes,
                `Event cancellation refund initiated via Stripe. Refund ID: ${refund.refundId}.`
              ),
            },
          })

          return { status: 'pending' as const }
        } catch (refundError) {
          const reason =
            refundError instanceof Error ? refundError.message : 'Unknown Stripe refund error'
          console.error(`Stripe refund initiation failed for order ${order.orderNumber}:`, refundError)

          await prisma.order.update({
            where: { id: order.id },
            data: {
              refundStatus: 'PENDING',
              refundReason,
              refundNotes: appendNote(
                order.refundNotes,
                `Event cancellation refund attempt failed (${reason}); manual refund required.`
              ),
            },
          })

          return { status: 'failed' as const }
        }
      })
    )

    const emailResults = await sendCancellationEmails(
      affectedOrders,
      cancelledEvent.title,
      formatDateTime(cancelledEvent.startDate)
    )

    const paidCancelledCount = affectedOrders.filter((order) => order.status === 'PAID').length
    const pendingCancelledCount = affectedOrders.length - paidCancelledCount
    const refundCompletedCount = refundResults.filter((result) => result.status === 'completed').length
    const refundPendingCount = refundResults.filter((result) => result.status === 'pending').length
    const refundFailedCount = refundResults.filter((result) => result.status === 'failed').length

    return NextResponse.json({
      data: cancelledEvent,
      summary: {
        ordersCancelled: affectedOrders.length,
        pendingOrInvoiceOrdersCancelled: pendingCancelledCount,
        paidOrdersCancelled: paidCancelledCount,
        paymentRefunds: {
          attempted: refundableGatewayOrders.length,
          completed: refundCompletedCount,
          pending: refundPendingCount,
          failed: refundFailedCount,
        },
        cancellationEmails: {
          sent: emailResults.sentCount,
          failed: emailResults.failedCount,
        },
      },
      message: `Event cancelled. ${affectedOrders.length} orders updated, ${emailResults.sentCount} cancellation emails sent.`,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return errorResponse('Unauthorized.', 401)
      }

      if (error.message.includes('Forbidden')) {
        return errorResponse(error.message, 403)
      }
    }

    console.error('Cancel event failed:', error)
    return errorResponse(
      'Could not cancel the event due to a system error. Please try again.',
      500
    )
  }
}
