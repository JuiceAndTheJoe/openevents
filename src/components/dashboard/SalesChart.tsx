import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type TopEvent = {
  eventId: string
  title: string
  revenue: number
  ticketsSold: number
  startDate: Date
}

type SalesChartProps = {
  title?: string
  data: TopEvent[]
  currency?: string
  showCreateEventCta?: boolean
}

function formatStartDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function SalesChart({ title = 'Top Selling Events', data, currency = 'SEK', showCreateEventCta = false }: SalesChartProps) {
  return (
    <section className="rounded-xl border border-[#f3f4f6] bg-white p-6 shadow-md">
      <h3 className="text-2xl font-bold text-gray-900">{title}</h3>

      {data.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium">No sales data yet</p>
          <p className="mt-1 text-sm text-gray-500 text-center max-w-xs">
            Your top selling events will appear here once you start receiving orders.
          </p>
          {showCreateEventCta && (
            <Link href="/create-event" className="mt-4 inline-flex rounded-md bg-[#5C8BD9] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a7bc9]">
              Create Your First Event
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {data.map((event, i) => (
            <Link
              key={event.eventId}
              href={`/dashboard/events/${event.eventId}`}
              className="flex items-start gap-4 rounded-[10px] bg-[#f9fafb] px-4 pt-4 pb-4 transition-colors hover:bg-gray-100"
            >
              {/* Rank badge */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5c8bd9]">
                <span className="text-base font-bold leading-none text-white">{i + 1}</span>
              </div>

              {/* Event info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-gray-900">{event.title}</p>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 shrink-0 text-[#4a5565]" />
                    <span className="whitespace-nowrap text-sm text-[#4a5565]">
                      {formatStartDate(event.startDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Revenue + tickets */}
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-[#5c8bd9]">
                  {formatCurrency(event.revenue, currency)}
                </p>
                <p className="text-sm text-[#4a5565]">{event.ticketsSold} tickets</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
