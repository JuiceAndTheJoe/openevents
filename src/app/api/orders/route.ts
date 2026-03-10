import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
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
import { getVatRateForCountryNameOrCode } from '@/lib/pricing/vatRates'
import { getIncludedVatFromVatInclusiveTotal } from '@/lib/pricing/vat'

type DiscountCodeWithLinks = Prisma.DiscountCodeGetPayload<{
  include: { ticketTypes: true }
}>

type GroupDiscountRecord = {
  id: string
  ticketTypeId: string | null
  minQuantity: number
  discountType: string
  discountValue: Prisma.Decimal
  isActive: boolean
}

function calculateGroupDiscountAmount(
  groupDiscount: GroupDiscountRecord,
  items: { ticketTypeId: string; quantity: number; totalPrice: number }[]
): number {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)

  // Check if discount applies
  if (groupDiscount.ticketTypeId === null) {
    // Global discount - check total quantity
    if (totalQuantity < groupDiscount.minQuantity) return 0

    const value = decimalToNumber(groupDiscount.discountValue)
    if (groupDiscount.discountType === 'PERCENTAGE') {
      return Number(Math.min(subtotal, (subtotal * value) / 100).toFixed(2))
    } else {
      return Number(Math.min(subtotal, value).toFixed(2))
    }
  } else {
    // Ticket-specific discount
    const applicableItem = items.find(item => item.ticketTypeId === groupDiscount.ticketTypeId)
    if (!applicableItem || applicableItem.quantity < groupDiscount.minQuantity) return 0

    const value = decimalToNumber(groupDiscount.discountValue)
    if (groupDiscount.discountType === 'PERCENTAGE') {
      return Number(Math.min(applicableItem.totalPrice, (applicableItem.totalPrice * value) / 100).toFixed(2))
    } else {
      return Number(Math.min(applicableItem.totalPrice, value).toFixed(2))
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const reservationTtlMinutes = getOrderReservationTtlMinutes(
      process.env.ORDER_RESERVATION_TTL_MINUTES ??
        process.env.NEXT_PUBLIC_ORDER_RESERVATION_TTL_MINUTES
    )

    // Get session optionally - allow both authenticated and anonymous orders
    const session = await getSession()
    const user = session?.user || null

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
    // Use buyer email from form - always required regardless of auth status
    const buyerEmail = input.buyer.email?.trim()

    if (!buyerEmail) {
      return NextResponse.json(
        { error: 'Buyer email is required to place an order' },
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

        const vatRate = getVatRateForCountryNameOrCode(event.country ?? '')
        const preparedOrder = prepareOrderItems(ticketTypes, input.items, { vatRate })

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
        let promoCodeDiscountAmount = 0
        let promoCodeError: string | null = null // Track promo code validation errors

        if (input.discountCode) {
          const foundDiscountCode = await tx.discountCode.findUnique({
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

          if (!foundDiscountCode) {
            promoCodeError = 'Discount code not found'
          } else {
            const now = new Date()
            if (
              !foundDiscountCode.isActive ||
              (foundDiscountCode.validFrom && foundDiscountCode.validFrom > now) ||
              (foundDiscountCode.validUntil && foundDiscountCode.validUntil < now)
            ) {
              promoCodeError = 'Discount code is inactive, expired, or fully used'
            } else {
              discountApplicableTicketTypeIds = getApplicableTicketTypeIds(foundDiscountCode)
              const appliesToAll = discountApplicableTicketTypeIds.length === 0

              if (discountApplicableTicketTypeIds.length > 0) {
                const hasApplicableItem = preparedOrder.items.some((item) =>
                  discountApplicableTicketTypeIds.includes(item.ticketTypeId)
                )

                if (!hasApplicableItem) {
                  promoCodeError = 'Discount code does not apply to selected ticket types'
                }
              }

              if (!promoCodeError) {
                discountUsageUnits = getDiscountUsageUnitsFromItems(
                  preparedOrder.items.filter((item) =>
                    appliesToAll ? true : discountApplicableTicketTypeIds.includes(item.ticketTypeId)
                  )
                )

                if (foundDiscountCode.maxUses !== null) {
                  const remainingUses = getDiscountCodeRemainingTicketUses(foundDiscountCode) ?? 0
                  if (discountUsageUnits > remainingUses) {
                    promoCodeError = 'Discount code has no remaining uses for this quantity of tickets.'
                  }
                }
              }

              if (!promoCodeError) {
                // Calculate promo code discount amount
                const discountableSubtotal = preparedOrder.items.reduce((sum, item) => {
                  if (appliesToAll || discountApplicableTicketTypeIds.includes(item.ticketTypeId)) {
                    return Number((sum + item.totalPrice).toFixed(2))
                  }
                  return sum
                }, 0)

                if (foundDiscountCode.minCartAmount !== null) {
                  const minQuantity = decimalToNumber(foundDiscountCode.minCartAmount)
                  const totalApplicableQuantity = preparedOrder.items.reduce((sum, item) => {
                    if (appliesToAll || discountApplicableTicketTypeIds.includes(item.ticketTypeId)) {
                      return sum + item.quantity
                    }
                    return sum
                  }, 0)
                  if (totalApplicableQuantity < minQuantity) {
                    promoCodeError = `At least ${minQuantity} ticket(s) of the applicable type are required for this discount code`
                  }
                }

                if (!promoCodeError) {
                  discountCodeRecord = foundDiscountCode
                  promoCodeDiscountAmount = calculateDiscountAmount(
                    discountableSubtotal,
                    foundDiscountCode.discountType,
                    decimalToNumber(foundDiscountCode.discountValue)
                  )
                }
              }
            }
          }
        }

        // Fetch and validate group discount if provided
        let groupDiscountRecord: GroupDiscountRecord | null = null
        let groupDiscountAmount = 0

        if (input.groupDiscountId) {
          const gd = await tx.groupDiscount.findUnique({
            where: { id: input.groupDiscountId },
            select: {
              id: true,
              eventId: true,
              ticketTypeId: true,
              minQuantity: true,
              discountType: true,
              discountValue: true,
              isActive: true,
            },
          })

          if (gd && gd.eventId === input.eventId && gd.isActive) {
            groupDiscountRecord = gd
            groupDiscountAmount = calculateGroupDiscountAmount(gd, preparedOrder.items)
          }
        }

        // Apply the best discount: whichever saves the customer more
        const subtotal = preparedOrder.subtotal
        let discountAmount = 0
        let appliedGroupDiscountId: string | null = null
        let appliedDiscountCodeId: string | null = null
        let promoCodeIgnoredForGroupDiscount = false

        if (groupDiscountAmount > promoCodeDiscountAmount) {
          // Group discount wins
          discountAmount = groupDiscountAmount
          appliedGroupDiscountId = groupDiscountRecord?.id ?? null
          // Don't claim promo code usage since we're not using it
          discountUsageUnits = 0
          // Track if we ignored a valid promo code for a better group discount
          if (promoCodeDiscountAmount > 0) {
            promoCodeIgnoredForGroupDiscount = true
          }
        } else if (promoCodeDiscountAmount > 0) {
          // Promo code wins (or tie goes to promo code)
          discountAmount = promoCodeDiscountAmount
          appliedDiscountCodeId = discountCodeRecord?.id ?? null
        } else if (promoCodeError && groupDiscountAmount > 0) {
          // Promo code was invalid but group discount applies - use group discount
          discountAmount = groupDiscountAmount
          appliedGroupDiscountId = groupDiscountRecord?.id ?? null
          promoCodeIgnoredForGroupDiscount = true
        } else if (promoCodeError) {
          // Promo code was invalid and no group discount available - throw the error
          throw new Error(promoCodeError)
        }

        const totalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2))
        const vatAmount = getIncludedVatFromVatInclusiveTotal(totalAmount, vatRate)

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
            userId: user?.id, // Associate with user if logged in
            eventId: input.eventId,
            discountCodeId: appliedDiscountCodeId,
            groupDiscountId: appliedGroupDiscountId,
            buyerFirstName: input.buyer.firstName,
            buyerLastName: input.buyer.lastName,
            buyerTitle: input.buyer.title,
            buyerEmail: buyerEmail,
            buyerOrganization: input.buyer.organization,
            buyerAddress: input.buyer.address,
            buyerCity: input.buyer.city,
            buyerPostalCode: input.buyer.postalCode,
            buyerCountry: input.buyer.country,
            subtotal,
            discountAmount,
            totalAmount,
            vatRate,
            vatAmount,
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

        // Only claim discount code usage if the promo code was actually applied (not when group discount won)
        if (discountCodeRecord && appliedDiscountCodeId && discountUsageUnits > 0) {
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

        const finalOrder = await tx.order.findUniqueOrThrow({
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

        // Return order with promo code warning if applicable
        return {
          order: finalOrder,
          promoCodeWarning: promoCodeError && promoCodeIgnoredForGroupDiscount
            ? `${promoCodeError}. A group discount was applied instead.`
            : null,
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    const { order, promoCodeWarning } = createdOrder

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

    if (order.status === 'PAID') {
      await sendOrderConfirmationEmail(order.buyerEmail, {
        orderNumber: order.orderNumber,
        eventTitle: order.event.title,
        eventDate: formatDateTime(order.event.startDate),
        eventLocation:
          order.event.locationType === 'ONLINE'
            ? order.event.onlineUrl || 'Online event'
            : [order.event.venue, order.event.city, order.event.country]
                .filter(Boolean)
                .join(', '),
        tickets: order.items.map((item) => ({
          name: item.ticketType.name,
          quantity: item.quantity,
          price: `${item.totalPrice.toString()} ${order.currency}`,
        })),
        totalAmount: `${order.totalAmount.toString()} ${order.currency}`,
        buyerName: `${order.buyerFirstName} ${order.buyerLastName}`,
      })
    }

    // Notify organizer of new invoice order
    if (order.status === 'PENDING_INVOICE') {
      const organizerEmail = order.event.organizer?.user?.email
      if (organizerEmail) {
        await sendInvoiceOrderNotificationEmail(organizerEmail, {
          orderNumber: order.orderNumber,
          eventTitle: order.event.title,
          eventId: order.event.id,
          buyerName: `${order.buyerFirstName} ${order.buyerLastName}`,
          buyerEmail: order.buyerEmail,
          totalAmount: order.totalAmount.toString(),
          currency: order.currency,
          tickets: order.items.map((item) => ({
            name: item.ticketType.name,
            quantity: item.quantity,
            price: `${item.totalPrice.toString()} ${order.currency}`,
          })),
          vatRate: order.vatRate ? parseFloat(order.vatRate.toString()) : null,
          vatAmount: order.vatAmount ? order.vatAmount.toString() : null,
        })
      }
    }

    return NextResponse.json({
      order,
      checkout: {
        requiresPayment: order.status === 'PENDING',
        isInvoiceFlow: order.status === 'PENDING_INVOICE',
        isFreeOrder: order.status === 'PAID' && order.paymentMethod === 'FREE',
        reservationTtlMinutes,
        reservationExpiresAt: order.expiresAt?.toISOString() ?? null,
      },
      message:
        order.status === 'PAID'
          ? 'Order created and completed successfully'
          : 'Order created successfully',
      ...(promoCodeWarning && { warning: promoCodeWarning }),
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
