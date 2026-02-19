import { NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'

const revenueStatuses: OrderStatus[] = ['PAID', 'PENDING_INVOICE']

export async function GET() {
  try {
    const { organizerProfile } = await requireOrganizerProfile()

    const now = new Date()

    const [eventCounts, ticketStats, revenueStats, recentRevenueByEvent] = await prisma.$transaction([
      prisma.event.findMany({
        where: {
          organizerId: organizerProfile.id,
        },
        select: {
          status: true,
        },
      }),
      prisma.ticketType.aggregate({
        where: {
          event: {
            organizerId: organizerProfile.id,
          },
        },
        _sum: {
          soldCount: true,
        },
      }),
      prisma.order.aggregate({
        where: {
          event: {
            organizerId: organizerProfile.id,
          },
          status: {
            in: revenueStatuses,
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.order.groupBy({
        by: ['eventId'],
        where: {
          event: {
            organizerId: organizerProfile.id,
          },
          status: {
            in: revenueStatuses,
          },
        },
        _sum: {
          totalAmount: true,
        },
        orderBy: {
          _sum: {
            totalAmount: 'desc',
          },
        },
        take: 5,
      }),
    ])

    const statusCounts = eventCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, {})

    const topEventIds = recentRevenueByEvent.map((item) => item.eventId)
    const topEvents = topEventIds.length
      ? await prisma.event.findMany({
          where: { id: { in: topEventIds } },
          select: { id: true, title: true },
        })
      : []

    const topEventMap = new Map(topEvents.map((event) => [event.id, event.title]))

    const upcomingEvents = await prisma.event.count({
      where: {
        organizerId: organizerProfile.id,
        status: 'PUBLISHED',
        startDate: {
          gte: now,
        },
      },
    })

    return NextResponse.json({
      data: {
        totalEvents: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        publishedEvents: statusCounts.PUBLISHED ?? 0,
        draftEvents: statusCounts.DRAFT ?? 0,
        cancelledEvents: statusCounts.CANCELLED ?? 0,
        completedEvents: statusCounts.COMPLETED ?? 0,
        upcomingEvents,
        totalTicketsSold: ticketStats._sum?.soldCount ?? 0,
        totalRevenue: Number(revenueStats._sum?.totalAmount?.toString() ?? '0'),
        totalRevenueOrders: revenueStats._count?._all ?? 0,
        topRevenueEvents: recentRevenueByEvent.map((item) => ({
          eventId: item.eventId,
          title: topEventMap.get(item.eventId) ?? 'Unknown event',
          revenue: Number(item._sum?.totalAmount?.toString() ?? '0'),
        })),
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

    console.error('Dashboard statistics failed:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard statistics' }, { status: 500 })
  }
}
