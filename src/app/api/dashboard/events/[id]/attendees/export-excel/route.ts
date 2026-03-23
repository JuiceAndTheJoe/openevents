import { NextResponse } from 'next/server'
import { TicketStatus, Prisma } from '@prisma/client'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireOrganizerProfile()
    const { id } = await context.params

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as TicketStatus | null

    const event = await prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        startDate: true,
        timezone: true,
        locationType: true,
        venue: true,
        city: true,
        country: true,
        onlineUrl: true,
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
        ticketType: {
          select: {
            name: true,
            price: true,
            currency: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
            createdAt: true,
            buyerFirstName: true,
            buyerLastName: true,
            buyerEmail: true,
            buyerCity: true,
            buyerCountry: true,
            currency: true,
          },
        },
      },
      orderBy: [
        { order: { createdAt: 'asc' } },
        { createdAt: 'asc' },
      ],
    })

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Attendees')

    // Column headers matching the reference format
    sheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 20 },
      { header: 'Order date', key: 'orderDate', width: 22 },
      { header: 'Attendee first name', key: 'attendeeFirstName', width: 20 },
      { header: 'Attendee last name', key: 'attendeeLastName', width: 20 },
      { header: 'Attendee email', key: 'attendeeEmail', width: 30 },
      { header: 'Phone number', key: 'phoneNumber', width: 15 },
      { header: 'Purchaser city', key: 'purchaserCity', width: 18 },
      { header: 'Purchaser state', key: 'purchaserState', width: 18 },
      { header: 'Purchaser country', key: 'purchaserCountry', width: 18 },
      { header: 'Event name', key: 'eventName', width: 30 },
      { header: 'Event ID', key: 'eventId', width: 20 },
      { header: 'Event start date', key: 'eventStartDate', width: 16 },
      { header: 'Event start time', key: 'eventStartTime', width: 16 },
      { header: 'Event timezone', key: 'eventTimezone', width: 20 },
      { header: 'Event location', key: 'eventLocation', width: 25 },
      { header: 'Ticket quantity', key: 'ticketQuantity', width: 15 },
      { header: 'Ticket tier', key: 'ticketTier', width: 15 },
      { header: 'Ticket type', key: 'ticketType', width: 25 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Ticket price', key: 'ticketPrice', width: 14 },
      { header: 'Buyer first name', key: 'buyerFirstName', width: 18 },
      { header: 'Buyer last name', key: 'buyerLastName', width: 18 },
      { header: 'Buyer email', key: 'buyerEmail', width: 30 },
      { header: 'Seating location 1', key: 'seating1', width: 18 },
      { header: 'Seating location 2', key: 'seating2', width: 18 },
      { header: 'Seating location 3', key: 'seating3', width: 18 },
      { header: 'Barcode number', key: 'barcodeNumber', width: 28 },
      { header: 'Scanned in', key: 'scannedIn', width: 14 },
      { header: 'Guest', key: 'guest', width: 8 },
    ]

    // Style header row
    sheet.getRow(1).font = { bold: true }

    // Format event date/time
    const eventStartDate = event.startDate.toISOString().split('T')[0]
    const eventStartTime = event.startDate.toTimeString().split(' ')[0]
    const eventLocation =
      event.locationType === 'ONLINE'
        ? event.onlineUrl || 'Online'
        : [event.venue, event.city, event.country].filter(Boolean).join(', ') || 'TBD'

    for (const ticket of tickets) {
      const attendeeFirstName = ticket.attendeeFirstName || ticket.order.buyerFirstName
      const attendeeLastName = ticket.attendeeLastName || ticket.order.buyerLastName
      const attendeeEmail = ticket.attendeeEmail || ticket.order.buyerEmail

      const orderDate = ticket.order.createdAt.toISOString().replace('T', ' ').substring(0, 19)

      sheet.addRow({
        orderId: ticket.order.orderNumber,
        orderDate,
        attendeeFirstName,
        attendeeLastName,
        attendeeEmail,
        phoneNumber: '',
        purchaserCity: ticket.order.buyerCity || '',
        purchaserState: '',
        purchaserCountry: ticket.order.buyerCountry || '',
        eventName: event.title,
        eventId: event.id,
        eventStartDate,
        eventStartTime,
        eventTimezone: event.timezone,
        eventLocation,
        ticketQuantity: 1,
        ticketTier: '',
        ticketType: ticket.ticketType.name,
        currency: ticket.order.currency,
        ticketPrice: Number(ticket.ticketType.price).toFixed(2),
        buyerFirstName: ticket.order.buyerFirstName,
        buyerLastName: ticket.order.buyerLastName,
        buyerEmail: ticket.order.buyerEmail,
        seating1: '',
        seating2: '',
        seating3: '',
        barcodeNumber: ticket.ticketCode,
        scannedIn: ticket.checkedInAt || ticket.status === 'USED' ? 'Yes' : 'No',
        guest: 'No',
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()

    const safeTitle = event.title
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeTitle}-attendees.xlsx"`,
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

    console.error('Attendee Excel export failed:', error)
    return NextResponse.json({ error: 'Failed to export attendees' }, { status: 500 })
  }
}
