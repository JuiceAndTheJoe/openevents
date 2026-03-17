import { NextRequest, NextResponse } from 'next/server'
import { EventStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

function csvCell(value: string | number | null | undefined) {
  const str = value === null || value === undefined ? '' : String(value)
  return `"${str.replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as EventStatus | null
    const organizerId = searchParams.get('organizerId')
    const query = searchParams.get('q')

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
    }

    if (status && ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'].includes(status)) {
      where.status = status
    }

    if (organizerId) {
      where.organizerId = organizerId
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { organizer: { orgName: { contains: query, mode: 'insensitive' } } },
      ]
    }

    const events = await prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        startDate: true,
        endDate: true,
        status: true,
        visibility: true,
        venue: true,
        city: true,
        country: true,
        createdAt: true,
        organizer: {
          select: {
            orgName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        ticketTypes: {
          select: {
            soldCount: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    const header = [
      'ID',
      'Title',
      'Slug',
      'Status',
      'Visibility',
      'Organizer',
      'Organizer Email',
      'Start Date',
      'End Date',
      'Venue',
      'City',
      'Country',
      'Orders',
      'Tickets Sold',
      'Created At',
    ]
    const lines = [header.join(',')]

    for (const event of events) {
      const ticketsSold = event.ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0)

      lines.push([
        csvCell(event.id),
        csvCell(event.title),
        csvCell(event.slug),
        csvCell(event.status),
        csvCell(event.visibility),
        csvCell(event.organizer.orgName),
        csvCell(event.organizer.user.email),
        csvCell(event.startDate.toISOString()),
        csvCell(event.endDate.toISOString()),
        csvCell(event.venue),
        csvCell(event.city),
        csvCell(event.country),
        csvCell(event._count.orders),
        csvCell(ticketsSold),
        csvCell(event.createdAt.toISOString()),
      ].join(','))
    }

    const csv = lines.join('\n')
    const filename = `events-export-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please sign in to continue.' },
          { status: 401 }
        )
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You do not have permission.' },
          { status: 403 }
        )
      }
    }

    console.error('Events export error:', error)
    return NextResponse.json(
      { error: 'Request failed', message: 'Failed to export events.' },
      { status: 500 }
    )
  }
}
