import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { lockTicketTypes, prepareOrderItems, generateTicketCreateInput } from '@/lib/orders'
import {
  calculateDiscountAmount,
  decimalToNumber,
  getApplicableTicketTypeIds,
  isDiscountCodeActive,
  normalizeDiscountCode,
} from '@/lib/tickets'
import { createOrderSchema } from '@/lib/validations'
import { formatDateTime, generateOrderNumber, isTicketAvailable } from '@/lib/utils'

type DiscountCodeWithLinks = Prisma.DiscountCodeGetPayload<{
  include: { ticketTypes: true }
}>

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
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
          },
        })

        if (!event) {
          throw new Error('Event not found')
        }

        if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
          throw new Error('Event is not open for ticket sales')
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

          if (!isDiscountCodeActive(discountCodeRecord)) {
            throw new Error('Discount code is inactive, expired, or fully used')
          }

          const applicableTicketTypeIds = getApplicableTicketTypeIds(discountCodeRecord)
          if (applicableTicketTypeIds.length > 0) {
            const hasApplicableItem = preparedOrder.items.some((item) =>
              applicableTicketTypeIds.includes(item.ticketTypeId)
            )

            if (!hasApplicableItem) {
              throw new Error('Discount code does not apply to selected ticket types')
            }
          }
        }

        const subtotal = preparedOrder.subtotal
        let discountAmount = 0

        if (discountCodeRecord) {
          const applicableTicketTypeIds = getApplicableTicketTypeIds(discountCodeRecord)
          const appliesToAll = applicableTicketTypeIds.length === 0

          const discountableSubtotal = preparedOrder.items.reduce((sum, item) => {
            if (appliesToAll || applicableTicketTypeIds.includes(item.ticketTypeId)) {
              return Number((sum + item.totalPrice).toFixed(2))
            }
            return sum
          }, 0)

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

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: user.id,
            eventId: input.eventId,
            discountCodeId: discountCodeRecord?.id,
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
            status,
            paymentMethod,
            paidAt: status === 'PAID' ? new Date() : null,
          },
          include: {
            items: true,
            event: true,
            tickets: true,
          },
        })

        if (preparedOrder.items.length > 0) {
          await tx.orderItem.createMany({
            data: preparedOrder.items.map((item) => ({
              orderId: order.id,
              ticketTypeId: item.ticketTypeId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
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

          const tickets = generateTicketCreateInput(order.id, preparedOrder.items)
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
          await tx.discountCode.update({
            where: { id: discountCodeRecord.id },
            data: {
              usedCount: {
                increment: 1,
              },
            },
          })
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

    return NextResponse.json({
      order: createdOrder,
      checkout: {
        requiresPayment: createdOrder.status === 'PENDING',
        isInvoiceFlow: createdOrder.status === 'PENDING_INVOICE',
        isFreeOrder: createdOrder.status === 'PAID' && createdOrder.paymentMethod === 'FREE',
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
        'One or more ticket types were not found for this event',
        'Discount code not found',
        'Discount code is inactive, expired, or fully used',
        'Discount code does not apply to selected ticket types',
      ])

      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message === 'Event not found') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      if (handledErrors.has(error.message) || error.message.includes('remaining capacity')) {
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
