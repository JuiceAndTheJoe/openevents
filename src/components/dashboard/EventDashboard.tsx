import Link from 'next/link'
import { EventStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { EventStatusBadge } from '@/components/dashboard/EventStatusBadge'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type EventDashboardProps = {
  event: {
    id: string
    slug: string
    title: string
    status: EventStatus
    startDate: Date
    endDate: Date
    createdAt: Date
    _count: {
      orders: number
      ticketTypes: number
    }
  }
  stats: {
    totalRevenue: number
    totalOrders: number
    paidOrders: number
    pendingInvoiceOrders: number
    cancelledOrders: number
    refundedOrders: number
    ticketsByType: Array<{
      name: string
      revenue: number
      sold: number
      remaining: number | null
    }>
  }
}

export function EventDashboard({ event, stats }: EventDashboardProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <div className="mt-2 flex items-center gap-2">
              <EventStatusBadge status={event.status} />
              <span className="text-sm text-gray-500">Created {formatDateTime(event.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {formatDateTime(event.startDate)} - {formatDateTime(event.endDate)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/events/${event.id}/edit`}>
              <Button variant="outline">Edit Event</Button>
            </Link>
            <Link href={`/dashboard/events/${event.id}/tickets`}>
              <Button variant="outline">Manage Tickets</Button>
            </Link>
            <Link href={`/dashboard/events/${event.id}/discounts`}>
              <Button variant="outline">Manage Discounts</Button>
            </Link>
            <Link href={`/dashboard/events/${event.id}/orders`}>
              <Button variant="outline">View Orders</Button>
            </Link>
            <Link href={`/dashboard/events/${event.id}/scan`}>
              <Button variant="outline">Scan Tickets</Button>
            </Link>
            <Link href={`/events/${event.slug}`}>
              <Button>Open Public Page</Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Ticket Types</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{event._count.ticketTypes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SalesChart
          title="Revenue by Ticket Type"
          data={stats.ticketsByType.map((item) => ({ label: item.name, value: item.revenue }))}
        />

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>Paid: {stats.paidOrders}</li>
            <li>Pending invoice: {stats.pendingInvoiceOrders}</li>
            <li>Cancelled: {stats.cancelledOrders}</li>
            <li>Refunded: {stats.refundedOrders}</li>
            <li>Total event orders: {event._count.orders}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
