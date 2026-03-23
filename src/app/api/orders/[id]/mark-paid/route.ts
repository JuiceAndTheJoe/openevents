import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma, PaymentMethod } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { formatDateTime } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Mark an invoice order as paid (organizer action)
 * This endpoint is used when an organizer has received payment for an invoice order
 * and needs to complete the order, generate tickets, and send confirmation.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const user = await requireAuth()

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

    // Only organizers or super admins can mark orders as paid
    const hasOrganizerRole = user.roles.includes('ORGANIZER') || user.roles.includes('SUPER_ADMIN')
    if (!hasOrganizerRole) {
      return NextResponse.json(
        { error: 'Only event organizers can mark orders as paid' },
        { status: 403 }
      )
    }

    if (order.status === 'PAID') {
      return NextResponse.json({ message: 'Order is already paid', order })
    }

    if (order.status !== 'PENDING_INVOICE') {
      return NextResponse.json(
        { error: `Only pending invoice orders can be marked as paid. Current status: ${order.status}` },
        { status: 409 }
      )
    }

    // Complete the order in a transaction
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

        if (latestOrder.status !== 'PENDING_INVOICE') {
          throw new Error(`Order cannot be marked as paid in status ${latestOrder.status}`)
        }

        // Update ticket counts: decrement reserved, increment sold
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
            paymentMethod: PaymentMethod.INVOICE,
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
            attendees: Array.isArray(item.attendeeData)
              ? (item.attendeeData as unknown as import('@/lib/orders').AttendeeData[])
              : undefined,
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

    // Send confirmation email to buyer
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
      ticketCodes: (paidOrder as typeof paidOrder & { tickets: Array<{ ticketCode: string }> }).tickets.map((t) => t.ticketCode),
    })

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

    return NextResponse.json({
      order: paidOrder,
      message: 'Order marked as paid successfully. Tickets generated and confirmation email sent.',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.startsWith('Order cannot be marked as paid')) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
    }

    console.error('Failed to mark order as paid:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
