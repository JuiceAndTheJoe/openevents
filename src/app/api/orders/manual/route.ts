import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendInvoiceOrderNotificationEmail } from '@/lib/email'
import { lockTicketTypes, prepareOrderItems } from '@/lib/orders'
import { claimDiscountCodeUsage, getDiscountUsageUnitsFromItems } from '@/lib/orders/discountUsage'
import {
  calculateDiscountAmount,
  decimalToNumber,
  getApplicableTicketTypeIds,
  getDiscountCodeRemainingTicketUses,
  normalizeDiscountCode,
} from '@/lib/tickets'
import { generateOrderNumber } from '@/lib/utils'
import { getVatRateForCountryNameOrCode } from '@/lib/pricing/vatRates'
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
  items: { ticketTypeId: string; quantity: number; totalPrice: number }[]
): number {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)

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

const manualOrderAttendeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  title: z.string().optional(),
  organization: z.string().optional(),
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
    organization: z.string().optional(),
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
            groupDiscountAmount = calculateGroupDiscountAmount(gd, preparedOrder.items)
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

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
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
            currency: ticketTypes[0]?.currency ?? 'SEK',
            status: 'PENDING_INVOICE',
            paymentMethod: 'INVOICE',
            expiresAt: null, // Invoice orders don't expire
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

        // Reserve tickets
        for (const item of preparedOrder.items) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              reservedCount: { increment: item.quantity },
            },
          })
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
            event: {
              select: {
                id: true,
                title: true,
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

    // Notify organizer of the new invoice order
    const organizerEmail = event.organizer.user.email
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
