import { EventStatus } from '@prisma/client'
import { EventActionButtons } from '@/components/dashboard/EventActionButtons'
import { EventStatusBadge } from '@/components/dashboard/EventStatusBadge'
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart'
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
  }
  stats: {
    totalRevenue: number
    totalTicketsSold: number
    totalOrders: number
    paidOrders: number
    pendingInvoiceOrders: number
    cancelledOrders: number
    refundedOrders: number
    refundedAmount: number
    refundRate: number
    ticketsByType: Array<{
      name: string
      revenue: number
      sold: number
      remaining: number | null
    }>
    dailySales: Array<{ date: string; revenue: number; ticketsSold: number }>
  }
}

export function EventDashboard({ event, stats }: EventDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Event header */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <div className="mt-2 flex items-center gap-2">
              <EventStatusBadge status={event.status === 'PUBLISHED' && new Date(event.endDate) < new Date() ? 'PASSED' : event.status} />
              <span className="text-sm text-gray-500">
                {`Created ${formatDateTime(event.createdAt)}`}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {formatDateTime(event.startDate)} - {formatDateTime(event.endDate)}
            </p>
          </div>

          <EventActionButtons eventId={event.id} eventSlug={event.slug} />
        </div>
      </section>

      {/* 4 stat cards: 2-col on mobile, 4-col on md+ */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Tickets Sold</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalTicketsSold}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Refund Rate</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.refundRate}%</p>
          {stats.refundedAmount > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {`${formatCurrency(stats.refundedAmount)} refunded`}
            </p>
          )}
        </div>
      </div>

      {/* 30-day sales trend — full width */}
      <SalesTrendChart
        title="Sales Trend – Last 30 Days"
        noDataText="No sales data yet."
        data={stats.dailySales}
      />

      {/* Ticket type breakdown table */}
      {stats.ticketsByType.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">Ticket Types</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-left font-medium text-gray-500">Type</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Sold</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Remaining</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.ticketsByType.map((tt, i) => (
                  <tr key={i}>
                    <td className="py-3 text-gray-900">{tt.name}</td>
                    <td className="py-3 text-right text-gray-700">{tt.sold}</td>
                    <td className="py-3 text-right text-gray-700">
                      {tt.remaining === null ? '∞' : tt.remaining}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {formatCurrency(tt.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Order breakdown */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Order Breakdown</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Paid', value: stats.paidOrders },
            { label: 'Pending Invoice', value: stats.pendingInvoiceOrders },
            { label: 'Cancelled', value: stats.cancelledOrders },
            { label: 'Refunded', value: stats.refundedOrders },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              <p className="mt-1 text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
