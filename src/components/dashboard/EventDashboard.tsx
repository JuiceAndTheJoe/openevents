import { EventStatus } from '@prisma/client'
import { ChevronDown } from 'lucide-react'
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
  const orderBreakdown = [
    { label: 'Paid', value: stats.paidOrders },
    { label: 'Pending Invoice', value: stats.pendingInvoiceOrders },
    { label: 'Cancelled', value: stats.cancelledOrders },
    { label: 'Refunded', value: stats.refundedOrders },
  ]

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

      {/* Core metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-full rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Excluding invoice and free orders</p>
        </div>

        <div className="h-full rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Tickets Sold</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {stats.totalTicketsSold}
            {(() => {
              const totalCapacity = stats.ticketsByType.every(tt => tt.remaining !== null)
                ? stats.ticketsByType.reduce((sum, tt) => sum + (tt.sold + (tt.remaining ?? 0)), 0)
                : null
              return totalCapacity !== null ? (
                <span className="text-base font-normal text-gray-500"> / {totalCapacity}</span>
              ) : null
            })()}
          </p>
          {stats.ticketsByType.length > 0 && (
            <div className="mt-2 space-y-1">
              {stats.ticketsByType.map((tt, i) => (
                <p key={i} className="text-xs text-gray-500">
                  {tt.name}: {tt.sold}{tt.remaining !== null ? ` / ${tt.sold + tt.remaining}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="h-full rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2 text-xs font-medium text-gray-600 [&::-webkit-details-marker]:hidden">
              Order breakdown
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {orderBreakdown.map(({ label, value }) => (
                <div key={label} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5 text-center">
                  <p className="text-sm font-semibold leading-none text-gray-900">{value}</p>
                  <p className="mt-1 text-[11px] leading-tight text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="h-full rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Refund Rate</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {stats.totalOrders === 0 ? '—' : `${Number.isNaN(stats.refundRate) ? 0 : stats.refundRate}%`}
          </p>
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
    </div>
  )
}
