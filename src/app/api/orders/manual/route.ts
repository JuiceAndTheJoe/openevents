import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  sendInvoiceOrderNotificationEmail,
  sendOrderConfirmationEmail,
  sendAttendeeTicketEmailsForOrder,
} from '@/lib/email'
import { generateTicketCreateInput, lockTicketTypes, prepareOrderItems } from '@/lib/orders'
import { claimDiscountCodeUsage, getDiscountUsageUnitsFromItems } from '@/lib/orders/discountUsage'
import {
  calculateDiscountAmount,
  decimalToNumber,
  getApplicableTicketTypeIds,
  getDiscountCodeRemainingTicketUses,
  normalizeDiscountCode,
} from '@/lib/tickets'
import { formatDateTime, generateOrderNumber } from '@/lib/utils'
import { getVatRateForCountryNameOrCode } from '@/lib/pricing/vatRates'
import { getIncludedVatFromVatInclusiveTotal } from '@/lib/pricing/vat'
import { z } from 'zod'

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
  items: { ticketTypeId: string; quantity: number; unitPrice: number; totalPrice: number }[],
  vatRate: number
): number {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  const value = decimalToNumber(groupDiscount.discountValue)
  const targetUnitInclVat = value * (1 + (vatRate ?? 0))

  if (groupDiscount.ticketTypeId === null) {
    if (totalQuantity < groupDiscount.minQuantity) return 0

    if (groupDiscount.discountType === 'PERCENTAGE') {
      return Number(Math.min(subtotal, (subtotal * value) / 100).toFixed(2))
    } else if (groupDiscount.discountType === 'TIER_PRICE') {
      const reduced = items.reduce(
        (sum, item) => sum + Math.max(0, item.unitPrice - targetUnitInclVat) * item.quantity,
        0
      )
      return Number(Math.min(subtotal, reduced).toFixed(2))
    } else {
      return Number(Math.min(subtotal, value).toFixed(2))
    }
  } else {
    const applicableItem = items.find(item => item.ticketTypeId === groupDiscount.ticketTypeId)
    if (!applicableItem || applicableItem.quantity < groupDiscount.minQuantity) return 0

    if (groupDiscount.discountType === 'PERCENTAGE') {
      return Number(Math.min(applicableItem.totalPrice, (applicableItem.totalPrice * value) / 100).toFixed(2))
    } else if (groupDiscount.discountType === 'TIER_PRICE') {
      const reduced = Math.max(0, applicableItem.unitPrice - targetUnitInclVat) * applicableItem.quantity
      return Number(Math.min(applicableItem.totalPrice, reduced).toFixed(2))
    } else {
      return Number(Math.min(applicableItem.totalPrice, value).toFixed(2))
    }
  }
}

const manualOrderAttendeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  title: z.string().optional(),
  organization: z.string().min(1, 'Organization is required'),
})

const manualOrderItemSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  attendees: z.array(manualOrderAttendeeSchema).optional(),
})

const createManualOrderSchema = z.object({
  eventId: z.string().cuid(),
  items: z.array(manualOrderItemSchema).min(1, 'At least one ticket is required'),
  buyer: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    title: z.string().optional(),
    email: z.string().email('Invalid email address'),
    organization: z.string().min(1, 'Organization is required'),
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }),
  discountCode: z.string().optional(),
  groupDiscountId: z.string().cuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const parsed = createManualOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const input = parsed.data

    // Verify organizer permission for the event
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: {
        id: true,
        title: true,
        status: true,
        country: true,
        organizer: {
          select: {
            id: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const hasOrganizerRole = user.roles.includes('ORGANIZER') || user.roles.includes('SUPER_ADMIN')
    if (!hasOrganizerRole) {
      return NextResponse.json(
        { error: 'Only event organizers can create manual orders' },
        { status: 403 }
      )
    }

    const ticketTypeIds = Array.from(new Set(input.items.map((item) => item.ticketTypeId)))

    const createdOrder = await prisma.$transaction(
      async (tx) => {
        await lockTicketTypes(tx, ticketTypeIds)

        const ticketTypes = await tx.ticketType.findMany({
          where: {
            eventId: input.eventId,
            id: { in: ticketTypeIds },
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
          },
        })

        if (ticketTypes.length !== ticketTypeIds.length) {
          throw new Error('One or more ticket types were not found for this event')
        }

        // Check capacity for each item
        for (const item of input.items) {
          const ticketType = ticketTypes.find((t) => t.id === item.ticketTypeId)
          if (!ticketType) {
            throw new Error(`Ticket type ${item.ticketTypeId} not found`)
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

        const vatRate = getVatRateForCountryNameOrCode(event.country ?? '')
        const preparedOrder = prepareOrderItems(ticketTypes, input.items, { vatRate })

        const subtotal = preparedOrder.subtotal

        // Handle discount codes and group discounts
        let discountCodeRecord: DiscountCodeWithLinks | null = null
        let discountUsageUnits = 0
        let discountApplicableTicketTypeIds: string[] = []
        let promoCodeDiscountAmount = 0

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

          if (foundDiscountCode && foundDiscountCode.isActive) {
            // Check validity period
            const now = new Date()
            const validFrom = foundDiscountCode.validFrom
            const validUntil = foundDiscountCode.validUntil

            if ((!validFrom || validFrom <= now) && (!validUntil || validUntil > now)) {
              discountApplicableTicketTypeIds = getApplicableTicketTypeIds(foundDiscountCode)

              // Calculate discountable subtotal
              const appliesToAll = discountApplicableTicketTypeIds.length === 0
              const applicableItems = preparedOrder.items
                .filter((item) => appliesToAll || discountApplicableTicketTypeIds.includes(item.ticketTypeId))

              let discountableSubtotal: number
              if (foundDiscountCode.maxTicketsPerOrder !== null) {
                const ticketPrices = applicableItems
                  .flatMap((item) => Array(item.quantity).fill(item.unitPrice) as number[])
                  .sort((a, b) => b - a)
                const cappedPrices = ticketPrices.slice(0, foundDiscountCode.maxTicketsPerOrder)
                discountableSubtotal = Number(cappedPrices.reduce((sum, p) => sum + p, 0).toFixed(2))
                discountUsageUnits = cappedPrices.length
              } else if (foundDiscountCode.applyToWholeOrder) {
                discountableSubtotal = applicableItems.reduce((sum, item) => sum + item.totalPrice, 0)
              } else {
                const maxUnitPrice = Math.max(0, ...applicableItems.map((item) => item.unitPrice))
                discountableSubtotal = maxUnitPrice
              }

              // Check usage limits
              const remainingTicketUses = getDiscountCodeRemainingTicketUses(foundDiscountCode)
              if (foundDiscountCode.maxTicketsPerOrder === null) {
                discountUsageUnits = foundDiscountCode.applyToWholeOrder
                  ? getDiscountUsageUnitsFromItems(applicableItems)
                  : 1
              }

              if (remainingTicketUses === null || remainingTicketUses >= discountUsageUnits) {
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
            groupDiscountAmount = calculateGroupDiscountAmount(gd, preparedOrder.items, vatRate)
          }
        }

        // Apply discounts based on discount code type
        let discountAmount = 0
        let appliedDiscountCodeId: string | null = null
        let appliedGroupDiscountId: string | null = null

        const isInvoiceCode = discountCodeRecord?.discountType === 'INVOICE'
        const isFreeNonInvoiceCode = discountCodeRecord && !isInvoiceCode &&
          (discountCodeRecord.discountType === 'FREE_TICKET' ||
           (discountCodeRecord.discountType === 'PERCENTAGE' && decimalToNumber(discountCodeRecord.discountValue) >= 100))

        if (isInvoiceCode) {
          // Invoice codes stack with group discounts
          discountAmount = groupDiscountAmount
          appliedGroupDiscountId = groupDiscountRecord?.id ?? null
          appliedDiscountCodeId = discountCodeRecord?.id ?? null
          discountUsageUnits = 0
        } else if (isFreeNonInvoiceCode) {
          // Non-invoice 100% off codes: order is free
          discountAmount = promoCodeDiscountAmount
          appliedDiscountCodeId = discountCodeRecord?.id ?? null
        } else if (groupDiscountAmount > promoCodeDiscountAmount) {
          discountAmount = groupDiscountAmount
          appliedGroupDiscountId = groupDiscountRecord?.id ?? null
        } else if (promoCodeDiscountAmount > 0) {
          discountAmount = promoCodeDiscountAmount
          appliedDiscountCodeId = discountCodeRecord?.id ?? null
        }

        const totalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2))
        const vatAmount = getIncludedVatFromVatInclusiveTotal(totalAmount, vatRate)

        // Free manual orders skip the invoice flow entirely — we don't invoice
        // anyone for a zero-total order.
        const isFreeOrder = totalAmount === 0
        const orderStatus = isFreeOrder ? 'PAID' : 'PENDING_INVOICE'
        const orderPaymentMethod = isFreeOrder ? 'FREE' : 'INVOICE'

        // Assign a sequential invoice number for all non-free invoice orders.
        // We call nextval inside the transaction so the number is only consumed
        // when the order actually commits (avoiding gaps from rolled-back orders).
        let invoiceNumber: number | null = null
        if (!isFreeOrder) {
          const seqResult = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('invoice_number_seq')`
          invoiceNumber = Number(seqResult[0].nextval)
        }

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            invoiceNumber: invoiceNumber ?? undefined,
            userId: null, // Manual orders don't have a user association
            eventId: input.eventId,
            discountCodeId: appliedDiscountCodeId,
            groupDiscountId: appliedGroupDiscountId,
            buyerFirstName: input.buyer.firstName,
            buyerLastName: input.buyer.lastName,
            buyerTitle: input.buyer.title,
            buyerEmail: input.buyer.email,
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
            status: orderStatus,
            paymentMethod: orderPaymentMethod,
            expiresAt: null,
            paidAt: isFreeOrder ? new Date() : null,
          },
        })

        // Build attendee data map
        const attendeesByTicketType = new Map(
          input.items
            .filter((item) => item.attendees && item.attendees.length > 0)
            .map((item) => [item.ticketTypeId, item.attendees!])
        )

        // Create order items
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

        if (isFreeOrder) {
          // Free manual orders complete immediately: count as sold and mint tickets.
          for (const item of preparedOrder.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: { soldCount: { increment: item.quantity } },
            })
          }

          const ticketCreateData = generateTicketCreateInput(
            order.id,
            preparedOrder.items.map((item) => ({
              ...item,
              attendees: attendeesByTicketType.get(item.ticketTypeId),
            }))
          )
          if (ticketCreateData.length > 0) {
            await tx.ticket.createMany({ data: ticketCreateData })
          }
        } else {
          for (const item of preparedOrder.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: { reservedCount: { increment: item.quantity } },
            })
          }
        }

        // Claim discount code usage if the promo code was applied
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

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            items: {
              include: {
                ticketType: {
                  select: { name: true },
                },
              },
            },
            tickets: true,
            groupDiscount: {
              select: {
                minQuantity: true,
                discountType: true,
                discountValue: true,
              },
            },
            discountCode: {
              select: {
                code: true,
              },
            },
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
          },
        })
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

    if (createdOrder.status === 'PAID' && createdOrder.paymentMethod === 'FREE') {
      // Free manual order: send the buyer their confirmation + tickets directly.
      const eventLocation =
        createdOrder.event.locationType === 'ONLINE'
          ? createdOrder.event.onlineUrl || 'Online event'
          : [createdOrder.event.venue, createdOrder.event.city, createdOrder.event.country]
              .filter(Boolean)
              .join(', ')
      const eventDate = formatDateTime(createdOrder.event.startDate)
      const buyerName = `${createdOrder.buyerFirstName} ${createdOrder.buyerLastName}`

      await sendOrderConfirmationEmail(createdOrder.buyerEmail, {
        orderNumber: createdOrder.orderNumber,
        orderId: createdOrder.id,
        eventTitle: createdOrder.event.title,
        eventDate,
        eventLocation,
        tickets: createdOrder.items.map((item) => ({
          name: item.ticketType.name,
          quantity: item.quantity,
          price: `${item.totalPrice.toString()} ${createdOrder.currency}`,
        })),
        totalAmount: `${createdOrder.totalAmount.toString()} ${createdOrder.currency}`,
        buyerName,
        vatRate: parseFloat(createdOrder.vatRate.toString()),
        vatAmount: createdOrder.vatAmount.toString(),
        ticketCodes: createdOrder.tickets.map((t) => t.ticketCode),
      })

      await sendAttendeeTicketEmailsForOrder({
        orderNumber: createdOrder.orderNumber,
        buyerEmail: createdOrder.buyerEmail,
        buyerName,
        eventTitle: createdOrder.event.title,
        eventDate,
        eventLocation,
        tickets: createdOrder.tickets,
        items: createdOrder.items,
      })
    } else {
      // Notify organizer of the new invoice order
      const organizerEmail = event.organizer.user.email
      if (organizerEmail) {
        const discountLabel = createdOrder.groupDiscount
          ? `group ${createdOrder.groupDiscount.minQuantity}+, ${
              createdOrder.groupDiscount.discountType === 'PERCENTAGE'
                ? `${Number(createdOrder.groupDiscount.discountValue.toString())}%`
                : `${Number(createdOrder.groupDiscount.discountValue.toString())} ${createdOrder.currency}`
            } off`
          : createdOrder.discountCode
            ? `code ${createdOrder.discountCode.code}`
            : null
        await sendInvoiceOrderNotificationEmail(organizerEmail, {
          orderNumber: createdOrder.orderNumber,
          eventTitle: createdOrder.event.title,
          eventId: createdOrder.event.id,
          buyerName: `${createdOrder.buyerFirstName} ${createdOrder.buyerLastName}`,
          buyerEmail: createdOrder.buyerEmail,
          currency: createdOrder.currency,
          subtotal: Number(createdOrder.subtotal.toString()),
          discountAmount: Number(createdOrder.discountAmount.toString()),
          discountLabel,
          vatRate: createdOrder.vatRate ? parseFloat(createdOrder.vatRate.toString()) : null,
          vatAmount: createdOrder.vatAmount ? Number(createdOrder.vatAmount.toString()) : null,
          totalAmount: Number(createdOrder.totalAmount.toString()),
          tickets: createdOrder.items.map((item) => ({
            name: item.ticketType.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice.toString()),
            lineTotal: Number(item.totalPrice.toString()),
          })),
        })
      }
    }

    return NextResponse.json({
      order: createdOrder,
      message: 'Manual order created successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message === 'Event not found') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      if (
        error.message.includes('remaining capacity') ||
        error.message.includes('not found') ||
        error.message.includes('Discount code')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    console.error('Failed to create manual order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
