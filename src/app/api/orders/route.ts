import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail, sendInvoiceOrderNotificationEmail } from '@/lib/email'
import { lockTicketTypes, prepareOrderItems, generateTicketCreateInput } from '@/lib/orders'
import { claimDiscountCodeUsage, getDiscountUsageUnitsFromItems } from '@/lib/orders/discountUsage'
import {
  getCheckoutUnavailableReason,
  getOrderErrorForCheckoutUnavailableReason,
} from '@/lib/orders/checkoutAvailability'
import { getOrderReservationExpiry, getOrderReservationTtlMinutes } from '@/lib/orders/reservation'
import {
  calculateDiscountAmount,
  decimalToNumber,
  getApplicableTicketTypeIds,
  getDiscountCodeRemainingTicketUses,
  normalizeDiscountCode,
} from '@/lib/tickets'
import { createOrderSchema } from '@/lib/validations'
import { formatDateTime, generateOrderNumber, isTicketAvailable } from '@/lib/utils'

type DiscountCodeWithLinks = Prisma.DiscountCodeGetPayload<{
  include: { ticketTypes: true }
}>

export async function POST(request: NextRequest) {
  try {
    const reservationTtlMinutes = getOrderReservationTtlMinutes(
      process.env.ORDER_RESERVATION_TTL_MINUTES ??
        process.env.NEXT_PUBLIC_ORDER_RESERVATION_TTL_MINUTES
    )

    const user = await requireAuth()
    const body = await request.json()

    // Reject attempts to stack multiple discount codes
    if (body.discountCodes && Array.isArray(body.discountCodes)) {
      return NextResponse.json(
        { error: 'Only one discount code can be applied per order' },
        { status: 422 }
      )
    }

    const parsed = createOrderSchema.safeParse(body)

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
    const accountEmail = user.email?.trim() || input.buyer.email?.trim()

    if (!accountEmail) {
      return NextResponse.json(
        { error: 'Authenticated account email is required to place an order' },
        { status: 400 }
      )
    }

    const createdOrder = await prisma.$transaction(
      async (tx) => {
        const event = await tx.event.findUnique({
          where: { id: input.eventId },
          select: {
            id: true,
            title: true,
            slug: true,
            startDate: true,
            endDate: true,
            locationType: true,
            venue: true,
            city: true,
            country: true,
            onlineUrl: true,
            status: true,
            ticketTypes: {
              where: { isVisible: true },
              select: {
                salesStartDate: true,
                salesEndDate: true,
                maxCapacity: true,
                soldCount: true,
                reservedCount: true,
                isVisible: true,
              },
            },
          },
        })

        if (!event) {
          throw new Error('Event not found')
        }

        const checkoutUnavailableReason = getCheckoutUnavailableReason(event)
        if (checkoutUnavailableReason) {
          throw new Error(getOrderErrorForCheckoutUnavailableReason(checkoutUnavailableReason))
        }

        const ticketTypeIds = Array.from(new Set(input.items.map((item) => item.ticketTypeId)))

        await lockTicketTypes(tx, ticketTypeIds)

        const ticketTypes = await tx.ticketType.findMany({
          where: {
            eventId: input.eventId,
            id: {
              in: ticketTypeIds,
            },
          },
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            minPerOrder: true,
            maxPerOrder: true,
            maxCapacity: true,
            soldCount: true,
            reservedCount: true,
            salesStartDate: true,
            salesEndDate: true,
          },
        })

        if (ticketTypes.length !== ticketTypeIds.length) {
          throw new Error('One or more ticket types were not found for this event')
        }

        const preparedOrder = prepareOrderItems(ticketTypes, input.items)

        for (const item of preparedOrder.items) {
          const ticketType = ticketTypes.find((ticket) => ticket.id === item.ticketTypeId)

          if (!ticketType) {
            throw new Error('Ticket type not found')
          }

          const available = isTicketAvailable(
            ticketType.salesStartDate,
            ticketType.salesEndDate,
            ticketType.maxCapacity,
            ticketType.soldCount,
            ticketType.reservedCount
          )

          if (!available) {
            throw new Error(`${ticketType.name} is not currently available`) // includes sold out / time-window
          }

          if (ticketType.maxCapacity !== null) {
            const remaining = ticketType.maxCapacity - ticketType.soldCount - ticketType.reservedCount
            if (remaining < item.quantity) {
              throw new Error(
                `${ticketType.name} does not have enough remaining capacity (${remaining} left)`
              )
            }
          }
        }

        let discountCodeRecord: DiscountCodeWithLinks | null = null
        let discountUsageUnits = 0
        let discountApplicableTicketTypeIds: string[] = []

        if (input.discountCode) {
          discountCodeRecord = await tx.discountCode.findUnique({
            where: {
              eventId_code: {
                eventId: input.eventId,
                code: normalizeDiscountCode(input.discountCode),
              },
            },
            include: {
              ticketTypes: true,
            },
          })

          if (!discountCodeRecord) {
            throw new Error('Discount code not found')
          }

          const now = new Date()
          if (
            !discountCodeRecord.isActive ||
            (discountCodeRecord.validFrom && discountCodeRecord.validFrom > now) ||
            (discountCodeRecord.validUntil && discountCodeRecord.validUntil < now)
          ) {
            throw new Error('Discount code is inactive, expired, or fully used')
          }

          discountApplicableTicketTypeIds = getApplicableTicketTypeIds(discountCodeRecord)
          const appliesToAll = discountApplicableTicketTypeIds.length === 0

          if (discountApplicableTicketTypeIds.length > 0) {
            const hasApplicableItem = preparedOrder.items.some((item) =>
              discountApplicableTicketTypeIds.includes(item.ticketTypeId)
            )

            if (!hasApplicableItem) {
              throw new Error('Discount code does not apply to selected ticket types')
            }
          }

          discountUsageUnits = getDiscountUsageUnitsFromItems(
            preparedOrder.items.filter((item) =>
              appliesToAll ? true : discountApplicableTicketTypeIds.includes(item.ticketTypeId)
            )
          )

          if (discountCodeRecord.maxUses !== null) {
            const remainingUses = getDiscountCodeRemainingTicketUses(discountCodeRecord) ?? 0
            if (discountUsageUnits > remainingUses) {
              throw new Error('Discount code has no remaining uses for this quantity of tickets.')
            }
          }
        }

        const subtotal = preparedOrder.subtotal
        let discountAmount = 0

        if (discountCodeRecord) {
          const appliesToAll = discountApplicableTicketTypeIds.length === 0

          const discountableSubtotal = preparedOrder.items.reduce((sum, item) => {
            if (appliesToAll || discountApplicableTicketTypeIds.includes(item.ticketTypeId)) {
              return Number((sum + item.totalPrice).toFixed(2))
            }
            return sum
          }, 0)

          if (discountCodeRecord.minCartAmount !== null) {
            const minQuantity = decimalToNumber(discountCodeRecord.minCartAmount)
            const totalApplicableQuantity = preparedOrder.items.reduce((sum, item) => {
              if (appliesToAll || discountApplicableTicketTypeIds.includes(item.ticketTypeId)) {
                return sum + item.quantity
              }
              return sum
            }, 0)
            if (totalApplicableQuantity < minQuantity) {
              throw new Error(
                `At least ${minQuantity} ticket(s) of the applicable type are required for this discount code`
              )
            }
          }

          discountAmount = calculateDiscountAmount(
            discountableSubtotal,
            discountCodeRecord.discountType,
            decimalToNumber(discountCodeRecord.discountValue)
          )
        }

        const totalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2))

        let status: 'PENDING' | 'PENDING_INVOICE' | 'PAID' = 'PENDING'
        let paymentMethod: 'PAYPAL' | 'INVOICE' | 'FREE' = 'PAYPAL'

        if (discountCodeRecord?.discountType === 'INVOICE') {
          status = 'PENDING_INVOICE'
          paymentMethod = 'INVOICE'
        } else if (totalAmount === 0 || discountCodeRecord?.discountType === 'FREE_TICKET') {
          status = 'PAID'
          paymentMethod = 'FREE'
        }

        const now = new Date()
        const expiresAt = status === 'PENDING' ? getOrderReservationExpiry(now, reservationTtlMinutes) : null

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: user.id,
            eventId: input.eventId,
            discountCodeId: discountCodeRecord?.id,
            buyerFirstName: input.buyer.firstName,
            buyerLastName: input.buyer.lastName,
            buyerTitle: input.buyer.title,
            buyerEmail: accountEmail,
            buyerOrganization: input.buyer.organization,
            buyerAddress: input.buyer.address,
            buyerCity: input.buyer.city,
            buyerPostalCode: input.buyer.postalCode,
            buyerCountry: input.buyer.country,
            subtotal,
            discountAmount,
            totalAmount,
            currency: ticketTypes[0]?.currency ?? 'SEK',
            status,
            paymentMethod,
            expiresAt,
            paidAt: status === 'PAID' ? now : null,
          },
          include: {
            items: true,
            event: true,
            tickets: true,
          },
        })

        // Build a map of attendee data from the request, keyed by ticketTypeId
        const attendeesByTicketType = new Map(
          input.items
            .filter((item) => item.attendees && item.attendees.length > 0)
            .map((item) => [item.ticketTypeId, item.attendees!])
        )

        if (preparedOrder.items.length > 0) {
          await tx.orderItem.createMany({
            data: preparedOrder.items.map((item) => ({
              orderId: order.id,
              ticketTypeId: item.ticketTypeId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              attendeeData: attendeesByTicketType.get(item.ticketTypeId) ?? undefined,
            })),
          })
        }

        if (status === 'PAID') {
          for (const item of preparedOrder.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: {
                soldCount: {
                  increment: item.quantity,
                },
              },
            })
          }

          const tickets = generateTicketCreateInput(
            order.id,
            preparedOrder.items.map((item) => ({
              ...item,
              attendees: attendeesByTicketType.get(item.ticketTypeId),
            }))
          )
          if (tickets.length > 0) {
            await tx.ticket.createMany({ data: tickets })
          }
        } else {
          for (const item of preparedOrder.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: {
                reservedCount: {
                  increment: item.quantity,
                },
              },
            })
          }
        }

        if (discountCodeRecord) {
          const usageClaimed = await claimDiscountCodeUsage(
            tx,
            discountCodeRecord.id,
            discountUsageUnits,
            discountCodeRecord.maxUses
          )

          if (!usageClaimed) {
            throw new Error('Discount code has no remaining uses for this quantity of tickets.')
          }
        }

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
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
                    user: {
                      select: {
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

    if (createdOrder.status === 'PAID') {
      await sendOrderConfirmationEmail(createdOrder.buyerEmail, {
        orderNumber: createdOrder.orderNumber,
        eventTitle: createdOrder.event.title,
        eventDate: formatDateTime(createdOrder.event.startDate),
        eventLocation:
          createdOrder.event.locationType === 'ONLINE'
            ? createdOrder.event.onlineUrl || 'Online event'
            : [createdOrder.event.venue, createdOrder.event.city, createdOrder.event.country]
                .filter(Boolean)
                .join(', '),
        tickets: createdOrder.items.map((item) => ({
          name: item.ticketType.name,
          quantity: item.quantity,
          price: `${item.totalPrice.toString()} ${createdOrder.currency}`,
        })),
        totalAmount: `${createdOrder.totalAmount.toString()} ${createdOrder.currency}`,
        buyerName: `${createdOrder.buyerFirstName} ${createdOrder.buyerLastName}`,
      })
    }

    // Notify organizer of new invoice order
    if (createdOrder.status === 'PENDING_INVOICE') {
      const organizerEmail = createdOrder.event.organizer?.user?.email
      if (organizerEmail) {
        await sendInvoiceOrderNotificationEmail(organizerEmail, {
          orderNumber: createdOrder.orderNumber,
          eventTitle: createdOrder.event.title,
          eventId: createdOrder.event.id,
          buyerName: `${createdOrder.buyerFirstName} ${createdOrder.buyerLastName}`,
          buyerEmail: createdOrder.buyerEmail,
          totalAmount: createdOrder.totalAmount.toString(),
          currency: createdOrder.currency,
          tickets: createdOrder.items.map((item) => ({
            name: item.ticketType.name,
            quantity: item.quantity,
            price: `${item.totalPrice.toString()} ${createdOrder.currency}`,
          })),
        })
      }
    }

    return NextResponse.json({
      order: createdOrder,
      checkout: {
        requiresPayment: createdOrder.status === 'PENDING',
        isInvoiceFlow: createdOrder.status === 'PENDING_INVOICE',
        isFreeOrder: createdOrder.status === 'PAID' && createdOrder.paymentMethod === 'FREE',
        reservationTtlMinutes,
        reservationExpiresAt: createdOrder.expiresAt?.toISOString() ?? null,
      },
      message:
        createdOrder.status === 'PAID'
          ? 'Order created and completed successfully'
          : 'Order created successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      const handledErrors = new Set([
        'Unauthorized',
        'Event not found',
        'Event is not open for ticket sales',
        'Event has already started',
        'No tickets are currently available for this event',
        'One or more ticket types were not found for this event',
        'Discount code not found',
        'Discount code is inactive, expired, or fully used',
        'Discount code has no remaining uses for this quantity of tickets.',
        'Discount code does not apply to selected ticket types',
        'Only one discount code can be applied per order',
      ])

      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message === 'Event not found') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      if (
        handledErrors.has(error.message) ||
        error.message.includes('remaining capacity') ||
        error.message.includes('ticket(s) of the applicable type')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      if (error.message.includes('Minimum quantity') || error.message.includes('Maximum quantity')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    console.error('Failed to create order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
