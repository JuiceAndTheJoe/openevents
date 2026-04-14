import Link from 'next/link'
import { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart'
import { getDashboardAnalytics } from '@/lib/analytics/dashboard-analytics'
import { WorkspacePageHeader } from '@/components/layout/WorkspaceShell'

export const dynamic = 'force-dynamic'

const revenueStatuses: OrderStatus[] = ['PAID']

export default async function DashboardHomePage() {
  const { organizerProfile, user } = await requireOrganizerProfile()

  const now = new Date()

  const eventWhere: Prisma.EventWhereInput = { deletedAt: null }
  const ticketWhere: Prisma.TicketTypeWhereInput = { event: { deletedAt: null } }
  const orderWhere: Prisma.OrderWhereInput = { event: { deletedAt: null } }

  // Run cached analytics and live dashboard data in parallel
  const [analytics, [eventsByStatus, ticketAgg, revenueAgg, upcomingEvents, recentOrders]] =
    await Promise.all([
      getDashboardAnalytics(),
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
            paymentMethod: 'PAYPAL',
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
            paymentMethod: true,
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
      <WorkspacePageHeader
        title={`Welcome, ${welcomeName}`}
        description="Platform-wide overview of events, orders, and revenue."
      />

      {stats.totalEvents === 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Get started with your first event</h2>
              <p className="mt-1 text-sm text-gray-600">Create an event to start selling tickets and managing attendees.</p>
            </div>
            <Link href="/create-event" className="inline-flex shrink-0 rounded-md bg-[#5C8BD9] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a7bc9]">
              Create Your First Event
            </Link>
          </div>
        </div>
      )}

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
            noDataText="No sales data yet"
            data={analytics.dailySales}
            showCreateEventCta={stats.totalEvents === 0}
          />
          <SalesChart
            title="Top Selling Events"
            data={analytics.topEvents}
            showCreateEventCta={stats.totalEvents === 0}
          />
        </div>
      </div>
    </div>
  )
}
