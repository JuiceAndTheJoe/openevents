import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause } from '@/lib/dashboard/organizer'
import { EventDashboard } from '@/components/dashboard/EventDashboard'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { getEventAnalytics } from '@/lib/analytics/event-analytics'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EventDetailDashboardPage({ params }: PageProps) {
  await requireOrganizerProfile()
  const { id } = await params

  const where = buildEventWhereClause(null, true, { id })

  const event = await prisma.event.findFirst({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
  })

  if (!event) notFound()

  // Run analytics (cached 5 min) and recent orders (always fresh) in parallel
  const [analytics, recentOrders] = await Promise.all([
    getEventAnalytics(event.id),
    prisma.order.findMany({
      where: { eventId: event.id },
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
  ])

  return (
    <div className="space-y-6">
      <EventDashboard
        event={event}
        stats={{
          totalRevenue: analytics.totalRevenue,
          totalTicketsSold: analytics.totalTicketsSold,
          totalOrders: analytics.orderCounts.total,
          paidOrders: analytics.orderCounts.paid,
          pendingInvoiceOrders: analytics.orderCounts.pendingInvoice,
          cancelledOrders: analytics.orderCounts.cancelled,
          refundedOrders: analytics.orderCounts.refunded,
          refundedAmount: analytics.refundedAmount,
          refundRate: analytics.refundRate,
          ticketsByType: analytics.ticketsByType,
          dailySales: analytics.dailySales,
        }}
      />

      <RecentOrders
        orders={recentOrders.map((order) => ({
          ...order,
          totalAmount: Number(order.totalAmount.toString()),
        }))}
      />
    </div>
  )
}
