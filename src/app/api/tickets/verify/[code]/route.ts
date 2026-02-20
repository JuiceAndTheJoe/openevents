import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type RouteParams = {
  params: Promise<{ code: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode: code },
    include: {
      order: {
        include: {
          event: {
            select: {
              id: true,
              title: true,
              organizerId: true,
            },
          },
        },
      },
    },
  })

  if (!ticket) {
    return NextResponse.json({ valid: false, error: 'Ticket not found' }, { status: 404 })
  }

  return NextResponse.json({
    valid: ticket.status === 'ACTIVE',
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    attendee: ticket.attendeeFirstName
      ? `${ticket.attendeeFirstName} ${ticket.attendeeLastName}`
      : null,
    event: ticket.order.event.title,
    checkedInAt: ticket.checkedInAt,
  })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode: code },
    include: {
      order: {
        include: {
          event: {
            select: {
              id: true,
              title: true,
              organizerId: true,
            },
          },
        },
      },
    },
  })

  if (!ticket) {
    return NextResponse.json({ valid: false, error: 'Ticket not found' }, { status: 404 })
  }

  // Verify the user is the organizer of this event
  const organizerProfile = await prisma.organizerProfile.findFirst({
    where: {
      userId: session.user.id,
      id: ticket.order.event.organizerId,
    },
  })

  if (!organizerProfile) {
    return NextResponse.json({ error: 'Not authorized to check in tickets for this event' }, { status: 403 })
  }

  if (ticket.status === 'USED') {
    return NextResponse.json(
      {
        valid: false,
        error: 'Already checked in',
        attendee: ticket.attendeeFirstName
          ? `${ticket.attendeeFirstName} ${ticket.attendeeLastName}`
          : null,
        checkedInAt: ticket.checkedInAt,
      },
      { status: 400 }
    )
  }

  if (ticket.status === 'CANCELLED') {
    return NextResponse.json(
      { valid: false, error: 'Ticket has been cancelled' },
      { status: 400 }
    )
  }

  // Mark ticket as used
  const updatedTicket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: 'USED',
      checkedInAt: new Date(),
    },
  })

  return NextResponse.json({
    valid: true,
    ticketCode: updatedTicket.ticketCode,
    attendee: updatedTicket.attendeeFirstName
      ? `${updatedTicket.attendeeFirstName} ${updatedTicket.attendeeLastName}`
      : null,
    event: ticket.order.event.title,
    checkedInAt: updatedTicket.checkedInAt,
  })
}
