import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type RouteParams = {
  params: Promise<{ code: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasOrganizerRole = session.user.roles?.includes('ORGANIZER') || session.user.roles?.includes('SUPER_ADMIN')
  if (!hasOrganizerRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { code } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode: code },
    select: {
      id: true,
      status: true,
    },
  })

  if (!ticket) {
    return NextResponse.json({ valid: false, error: 'Ticket not found' }, { status: 404 })
  }

  // Return minimal fields only - no PII
  return NextResponse.json({
    valid: ticket.status === 'ACTIVE',
    ticketId: ticket.id,
    status: ticket.status,
  })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasOrganizerRole = session.user.roles?.includes('ORGANIZER') || session.user.roles?.includes('SUPER_ADMIN')
  if (!hasOrganizerRole) {
    return NextResponse.json({ error: 'Not authorized to check in tickets' }, { status: 403 })
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
            },
          },
        },
      },
    },
  })

  if (!ticket) {
    return NextResponse.json({ valid: false, error: 'Ticket not found' }, { status: 404 })
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
