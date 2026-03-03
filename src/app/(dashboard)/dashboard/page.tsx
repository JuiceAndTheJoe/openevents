import { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart'
import { getDashboardAnalytics } from '@/lib/analytics/dashboard-analytics'

const revenueStatuses: OrderStatus[] = ['PAID']

export default async function DashboardHomePage() {
  const { organizerProfile, isSuperAdmin, user } = await requireOrganizerProfile()

  const now = new Date()

  // Build where clause based on role - super admins see all events
  const eventWhere: Prisma.EventWhereInput = isSuperAdmin
    ? { deletedAt: null }
    : { organizerId: organizerProfile!.id, deletedAt: null }

  const ticketWhere: Prisma.TicketTypeWhereInput = isSuperAdmin
    ? { event: { deletedAt: null } }
    : { event: { organizerId: organizerProfile!.id, deletedAt: null } }

  const orderWhere: Prisma.OrderWhereInput = isSuperAdmin
    ? { event: { deletedAt: null } }
    : { event: { organizerId: organizerProfile!.id, deletedAt: null } }

  // Run cached analytics and live dashboard data in parallel
  const [analytics, [eventsByStatus, ticketAgg, revenueAgg, upcomingEvents, recentOrders]] =
    await Promise.all([
      getDashboardAnalytics(isSuperAdmin ? null : organizerProfile!.id),
      prisma.$transaction([
        prisma.event.findMany({
          where: eventWhere,
          select: { status: true },
        }),
        prisma.ticketType.aggregate({
          where: ticketWhere,
          _sum: { soldCount: true },
        }),
        prisma.order.aggregate({
          where: {
            ...orderWhere,
            status: { in: revenueStatuses },
          },
          _sum: { totalAmount: true },
        }),
        prisma.event.findMany({
          where: {
            ...eventWhere,
            endDate: { gte: now },
          },
          select: { id: true, slug: true, title: true, startDate: true, status: true },
          orderBy: { startDate: 'asc' },
          take: 6,
        }),
        prisma.order.findMany({
          where: orderWhere,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            currency: true,
            buyerEmail: true,
            createdAt: true,
            event: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]),
    ])

  const statusCounts = eventsByStatus.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})

  const stats = {
    totalEvents: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    publishedEvents: statusCounts.PUBLISHED ?? 0,
    draftEvents: statusCounts.DRAFT ?? 0,
    upcomingEvents: upcomingEvents.length,
    totalTicketsSold: ticketAgg._sum.soldCount ?? 0,
    totalRevenue: Number(revenueAgg._sum.totalAmount?.toString() ?? '0'),
  }

  const welcomeName = organizerProfile?.orgName || user.name || 'Admin'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {`Welcome, ${welcomeName}`}
          </h1>
          <p className="text-gray-600">
            {isSuperAdmin ? 'Platform-wide overview of events, orders, and revenue.' : 'Overview of your events, orders, and revenue.'}
          </p>
        </div>
      </div>

      <DashboardStats stats={stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingEvents events={upcomingEvents} />
        <RecentOrders
          orders={recentOrders.map((order) => ({
            ...order,
            totalAmount: Number(order.totalAmount.toString()),
          }))}
        />
      </div>

      {/* Analytics section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Analytics</h2>
        <div className="space-y-6">
          <SalesTrendChart
            title="Sales Trend – Last 30 Days"
            noDataText="No data yet."
            data={analytics.dailySales}
          />
          <SalesChart
            title="Top Selling Events"
            data={analytics.topEvents}
          />
        </div>
      </div>
    </div>
  )
}
