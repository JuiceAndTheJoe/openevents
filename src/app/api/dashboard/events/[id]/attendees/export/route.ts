import { NextResponse } from 'next/server'
import { TicketStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'

type RouteContext = {
  params: Promise<{ id: string }>
}

function csvCell(value: string | number | null | undefined) {
  const str = value === null || value === undefined ? '' : String(value)
  return `"${str.replaceAll('"', '""')}"`
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireOrganizerProfile()
    const { id } = await context.params

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as TicketStatus | null

    // Verify the event exists and user has access
    const event = await prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const where: Prisma.TicketWhereInput = {
      order: {
        eventId: id,
        status: { in: ['PAID', 'PENDING_INVOICE'] },
      },
    }

    if (status && ['ACTIVE', 'CANCELLED', 'USED'].includes(status)) {
      where.status = status
    }

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        ticketCode: true,
        attendeeFirstName: true,
        attendeeLastName: true,
        attendeeEmail: true,
        attendeeTitle: true,
        attendeeOrganization: true,
        status: true,
        checkedInAt: true,
        order: {
          select: {
            orderNumber: true,
            buyerTitle: true,
            buyerFirstName: true,
            buyerLastName: true,
            buyerEmail: true,
            buyerOrganization: true,
          },
        },
      },
      orderBy: [
        { order: { createdAt: 'asc' } },
        { createdAt: 'asc' },
      ],
    })

    const header = [
      'ticketCode',
      'title',
      'firstName',
      'lastName',
      'organization',
      'email',
      'ticketStatus',
      'checkedIn',
      'orderNumber',
    ]
    const lines = [header.join(',')]

    for (const ticket of tickets) {
      // Use attendee info if available, otherwise fall back to buyer info
      const firstName = ticket.attendeeFirstName || ticket.order.buyerFirstName
      const lastName = ticket.attendeeLastName || ticket.order.buyerLastName
      const email = ticket.attendeeEmail || ticket.order.buyerEmail
      const title = ticket.attendeeTitle || ticket.order.buyerTitle || ''
      const organization = ticket.attendeeOrganization || ticket.order.buyerOrganization || ''

      lines.push([
        csvCell(ticket.ticketCode),
        csvCell(title),
        csvCell(firstName),
        csvCell(lastName),
        csvCell(organization),
        csvCell(email),
        csvCell(ticket.status),
        csvCell(ticket.checkedInAt ? 'Yes' : 'No'),
        csvCell(ticket.order.orderNumber),
      ].join(','))
    }

    const csv = lines.join('\n')

    // Create a safe filename from event title
    const safeTitle = event.title
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeTitle}-attendees.csv"`,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Attendee export failed:', error)
    return NextResponse.json({ error: 'Failed to export attendees' }, { status: 500 })
  }
}
