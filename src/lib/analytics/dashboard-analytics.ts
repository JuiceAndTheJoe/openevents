import { prisma } from '@/lib/db'
import { OrderStatus, Prisma } from '@prisma/client'

const revenueStatuses: OrderStatus[] = ['PAID']

export type DashboardAnalytics = {
  topEvents: Array<{ eventId: string; title: string; revenue: number }>
  dailySales: Array<{ date: string; revenue: number; ticketsSold: number }>
}

async function fetchDashboardAnalytics(organizerId: string | null): Promise<DashboardAnalytics> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  // Build where clause - null organizerId means platform-wide (super admin)
  const eventWhere: Prisma.EventWhereInput = organizerId
    ? { organizerId, deletedAt: null }
    : { deletedAt: null }

  const [topRevenue, trendOrders] = await prisma.$transaction([
    prisma.order.groupBy({
      by: ['eventId'],
      where: {
        event: eventWhere,
        status: { in: revenueStatuses },
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
        createdAt: true,
        paidAt: true,
        items: { select: { quantity: true } },
      },
    }),
  ])

  const topEventIds = topRevenue.map((e) => e.eventId)
  const events = topEventIds.length
    ? await prisma.event.findMany({
        where: { id: { in: topEventIds } },
        select: { id: true, title: true },
      })
    : []

  const titleMap = new Map(events.map((e) => [e.id, e.title]))
  const topEvents = topRevenue.map((item) => ({
    eventId: item.eventId,
    title: titleMap.get(item.eventId) ?? 'Unknown',
    revenue: Number(item._sum?.totalAmount?.toString() ?? '0'),
  }))

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
      dayStats.revenue += Number(o.totalAmount.toString())
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
export async function getDashboardAnalytics(organizerId: string | null): Promise<DashboardAnalytics> {
  return fetchDashboardAnalytics(organizerId)
}
