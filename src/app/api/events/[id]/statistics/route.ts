import { NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'

type RouteContext = {
  params: Promise<{ id: string }>
}

const revenueStatuses: OrderStatus[] = ['PAID']

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireOrganizerProfile()
    const { id } = await context.params

    const event = await prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        ticketTypes: {
          select: {
            id: true,
            name: true,
            soldCount: true,
            maxCapacity: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const [orderStats, paidRevenueAgg, paidItemGroups] = await prisma.$transaction([
      prisma.order.findMany({
        where: { eventId: id },
        select: { status: true },
      }),
      prisma.order.aggregate({
        where: {
          eventId: id,
          status: { in: revenueStatuses },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.orderItem.groupBy({
        by: ['ticketTypeId'],
        orderBy: {
          ticketTypeId: 'asc',
        },
        where: {
          order: {
            eventId: id,
            status: { in: revenueStatuses },
          },
        },
        _sum: {
          quantity: true,
          totalPrice: true,
        },
      }),
    ])

    const countsByStatus = orderStats.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    }, {})

    const byTicketType = event.ticketTypes.map((ticketType) => {
      const sales = paidItemGroups.find((group) => group.ticketTypeId === ticketType.id)
      const sold = sales?._sum?.quantity ?? 0
      const revenue = Number(sales?._sum?.totalPrice?.toString() ?? '0')

      return {
        ticketTypeId: ticketType.id,
        name: ticketType.name,
        sold,
        revenue,
        remaining: ticketType.maxCapacity === null ? null : Math.max(ticketType.maxCapacity - ticketType.soldCount, 0),
      }
    })

    const payload = {
      eventId: event.id,
      eventTitle: event.title,
      totalRevenue: Number(paidRevenueAgg._sum.totalAmount?.toString() ?? '0'),
      totalOrders: Object.values(countsByStatus).reduce((sum, count) => sum + count, 0),
      paidOrders: countsByStatus.PAID ?? 0,
      pendingInvoiceOrders: countsByStatus.PENDING_INVOICE ?? 0,
      cancelledOrders: countsByStatus.CANCELLED ?? 0,
      refundedOrders: (countsByStatus.REFUNDED ?? 0) + (countsByStatus.PARTIALLY_REFUNDED ?? 0),
      ticketsByType: byTicketType,
    }

    return NextResponse.json({ data: payload })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Event statistics failed:', error)
    return NextResponse.json({ error: 'Failed to fetch event statistics' }, { status: 500 })
  }
}
