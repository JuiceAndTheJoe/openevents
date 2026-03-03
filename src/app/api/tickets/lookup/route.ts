import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const lookupSchema = z.object({
  email: z.string().email('Invalid email format'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = lookupSchema.parse(body)

    // Query tickets where attendeeEmail matches OR order.buyerEmail matches
    const tickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { attendeeEmail: email },
          { order: { buyerEmail: email } },
        ],
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            buyerEmail: true,
            status: true,
            createdAt: true,
            totalAmount: true,
            currency: true,
            event: {
              select: {
                title: true,
                slug: true,
                startDate: true,
                coverImage: true,
              },
            },
          },
        },
        ticketType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Map tickets to a simpler structure for the frontend
    const mappedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      attendeeFirstName: ticket.attendeeFirstName,
      attendeeLastName: ticket.attendeeLastName,
      attendeeEmail: ticket.attendeeEmail,
      ticketType: ticket.ticketType.name,
      order: {
        orderNumber: ticket.order.orderNumber,
        status: ticket.order.status,
        createdAt: ticket.order.createdAt.toISOString(),
        totalAmount: Number(ticket.order.totalAmount.toString()),
        currency: ticket.order.currency,
        event: {
          title: ticket.order.event.title,
          slug: ticket.order.event.slug,
          startDate: ticket.order.event.startDate.toISOString(),
          coverImage: ticket.order.event.coverImage,
        },
      },
    }))

    return NextResponse.json({ tickets: mappedTickets })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Ticket lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup tickets' },
      { status: 500 }
    )
  }
}
