import { notFound } from 'next/navigation'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { EventDashboard } from '@/components/dashboard/EventDashboard'
import { RecentOrders } from '@/components/dashboard/RecentOrders'

const revenueStatuses: OrderStatus[] = ['PAID', 'PENDING_INVOICE']

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EventDetailDashboardPage({ params }: PageProps) {
  const { organizerProfile } = await requireOrganizerProfile()
  const { id } = await params

  const event = await prisma.event.findFirst({
    where: {
      id,
      organizerId: organizerProfile.id,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          ticketTypes: true,
        },
      },
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
    notFound()
  }

  const [orderStats, revenueAgg, ticketItemAgg, recentOrders] = await prisma.$transaction([
    prisma.order.findMany({
      where: { eventId: event.id },
      select: { status: true },
    }),
    prisma.order.aggregate({
      where: {
        eventId: event.id,
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
          eventId: event.id,
          status: { in: revenueStatuses },
        },
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
    }),
    prisma.order.findMany({
      where: {
        eventId: event.id,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        buyerEmail: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
    }),
  ])

  const countsByStatus = orderStats.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})

  const ticketsByType = event.ticketTypes.map((ticketType) => {
    const sales = ticketItemAgg.find((item) => item.ticketTypeId === ticketType.id)
    return {
      name: ticketType.name,
      sold: sales?._sum?.quantity ?? 0,
      revenue: Number(sales?._sum?.totalPrice?.toString() ?? '0'),
      remaining: ticketType.maxCapacity === null ? null : Math.max(ticketType.maxCapacity - ticketType.soldCount, 0),
    }
  })

  return (
    <div className="space-y-6">
      <EventDashboard
        event={event}
        stats={{
          totalRevenue: Number(revenueAgg._sum.totalAmount?.toString() ?? '0'),
          totalOrders: Object.values(countsByStatus).reduce((sum, count) => sum + count, 0),
          paidOrders: countsByStatus.PAID ?? 0,
          pendingInvoiceOrders: countsByStatus.PENDING_INVOICE ?? 0,
          cancelledOrders: countsByStatus.CANCELLED ?? 0,
          refundedOrders: (countsByStatus.REFUNDED ?? 0) + (countsByStatus.PARTIALLY_REFUNDED ?? 0),
          ticketsByType,
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
