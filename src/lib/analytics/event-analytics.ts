import { prisma } from '@/lib/db'
import { OrderStatus } from '@prisma/client'

const revenueStatuses: OrderStatus[] = ['PAID']
const refundStatuses: OrderStatus[] = ['REFUNDED', 'PARTIALLY_REFUNDED']

export type EventAnalytics = {
  totalRevenue: number
  totalTicketsSold: number
  refundedAmount: number
  refundRate: number
  ticketsByType: Array<{
    id: string
    name: string
    sold: number
    revenue: number
    remaining: number | null
  }>
  orderCounts: {
    paid: number
    pendingInvoice: number
    cancelled: number
    refunded: number
    total: number
  }
  dailySales: Array<{ date: string; revenue: number; ticketsSold: number }>
}

async function fetchEventAnalytics(eventId: string): Promise<EventAnalytics> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  const [orderRows, revenueAgg, refundAgg, itemAgg, ticketTypes, trendOrders] =
    await prisma.$transaction([
      prisma.order.findMany({
        where: { eventId },
        select: { status: true },
      }),
      prisma.order.aggregate({
        where: { eventId, status: { in: revenueStatuses } },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { eventId, status: { in: refundStatuses } },
        _sum: { totalAmount: true },
      }),
      prisma.orderItem.groupBy({
        by: ['ticketTypeId'],
        orderBy: { ticketTypeId: 'asc' },
        where: { order: { eventId, status: { in: revenueStatuses } } },
        _sum: { quantity: true, totalPrice: true },
      }),
      prisma.ticketType.findMany({
        where: { eventId },
        select: { id: true, name: true, soldCount: true, maxCapacity: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.order.findMany({
        where: {
          eventId,
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

  const countsByStatus = orderRows.reduce<Record<string, number>>((acc, { status }) => {
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})

  const totalOrders = Object.values(countsByStatus).reduce((s, c) => s + c, 0)
  const refundedOrders =
    (countsByStatus.REFUNDED ?? 0) + (countsByStatus.PARTIALLY_REFUNDED ?? 0)

  const ticketsByType = ticketTypes.map((tt) => {
    const s = itemAgg.find((i) => i.ticketTypeId === tt.id)
    return {
      id: tt.id,
      name: tt.name,
      sold: s?._sum?.quantity ?? 0,
      revenue: Number(s?._sum?.totalPrice?.toString() ?? '0'),
      remaining:
        tt.maxCapacity === null ? null : Math.max(tt.maxCapacity - tt.soldCount, 0),
    }
  })

  const totalTicketsSold = ticketsByType.reduce((s, t) => s + t.sold, 0)

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

  return {
    totalRevenue: Number(revenueAgg._sum.totalAmount?.toString() ?? '0'),
    totalTicketsSold,
    refundedAmount: Number(refundAgg._sum.totalAmount?.toString() ?? '0'),
    refundRate: totalOrders > 0 ? Math.round((refundedOrders / totalOrders) * 100) : 0,
    ticketsByType,
    orderCounts: {
      paid: countsByStatus.PAID ?? 0,
      pendingInvoice: countsByStatus.PENDING_INVOICE ?? 0,
      cancelled: countsByStatus.CANCELLED ?? 0,
      refunded: refundedOrders,
      total: totalOrders,
    },
    dailySales,
  }
}

// Keep sales trend live so organizers see newly paid orders immediately.
export async function getEventAnalytics(eventId: string): Promise<EventAnalytics> {
  return fetchEventAnalytics(eventId)
}
