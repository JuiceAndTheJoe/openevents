import { prisma } from '@/lib/db'
import { OrderStatus, Prisma } from '@prisma/client'

const revenueStatuses: OrderStatus[] = ['PAID']

export type DashboardAnalytics = {
  topEvents: Array<{
    eventId: string
    title: string
    revenue: number
    ticketsSold: number
    startDate: Date
  }>
  dailySales: Array<{ date: string; revenue: number; ticketsSold: number }>
}

async function fetchDashboardAnalytics(): Promise<DashboardAnalytics> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  const eventWhere: Prisma.EventWhereInput = { deletedAt: null }

  const [topRevenue, trendOrders] = await prisma.$transaction([
    prisma.order.groupBy({
      by: ['eventId'],
      where: {
        event: eventWhere,
        status: { in: revenueStatuses },
        paymentMethod: 'PAYPAL',
      },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        event: eventWhere,
        status: { in: revenueStatuses },
        OR: [
          { paidAt: { gte: thirtyDaysAgo } },
          { paidAt: null, createdAt: { gte: thirtyDaysAgo } },
        ],
      },
      select: {
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        paidAt: true,
        items: { select: { quantity: true } },
      },
    }),
  ])

  const topEventIds = topRevenue.map((e) => e.eventId)

  const [events, ticketRows] = topEventIds.length
    ? await Promise.all([
        prisma.event.findMany({
          where: { id: { in: topEventIds } },
          select: {
            id: true,
            title: true,
            startDate: true,
          },
        }),
        prisma.orderItem.findMany({
          where: {
            order: { eventId: { in: topEventIds }, status: { in: revenueStatuses } },
          },
          select: { quantity: true, ticketType: { select: { eventId: true } } },
        }),
      ])
    : [[], []]

  const eventMap = new Map(events.map((e) => [e.id, e]))
  const ticketsByEvent = new Map<string, number>()
  for (const row of ticketRows) {
    const eid = row.ticketType.eventId
    ticketsByEvent.set(eid, (ticketsByEvent.get(eid) ?? 0) + row.quantity)
  }

  const topEvents = topRevenue.map((item) => {
    const event = eventMap.get(item.eventId)
    return {
      eventId: item.eventId,
      title: event?.title ?? 'Unknown',
      revenue: Number(item._sum?.totalAmount?.toString() ?? '0'),
      ticketsSold: ticketsByEvent.get(item.eventId) ?? 0,
      startDate: event?.startDate ?? new Date(),
    }
  })

  // Build 30-day trend map (all days initialised to 0)
  const dailyMap = new Map<string, { revenue: number; ticketsSold: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dailyMap.set(d.toISOString().slice(0, 10), { revenue: 0, ticketsSold: 0 })
  }
  for (const o of trendOrders) {
    const saleDate = o.paidAt ?? o.createdAt
    const day = saleDate.toISOString().slice(0, 10)
    const dayStats = dailyMap.get(day)
    if (dayStats) {
      const orderTickets = o.items.reduce((sum, item) => sum + item.quantity, 0)
      if (o.paymentMethod === 'PAYPAL') {
        dayStats.revenue += Number(o.totalAmount.toString())
      }
      dayStats.ticketsSold += orderTickets
    }
  }
  const dailySales = Array.from(dailyMap.entries()).map(([date, stats]) => ({
    date,
    revenue: stats.revenue,
    ticketsSold: stats.ticketsSold,
  }))

  return { topEvents, dailySales }
}

// Keep sales trend live so organizers see newly paid orders immediately.
export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  return fetchDashboardAnalytics()
}
