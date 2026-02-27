import { formatCurrency } from '@/lib/utils'

type SalesTrendChartProps = {
  title: string
  noDataText: string
  data: Array<{ date: string; revenue: number | string | null; ticketsSold?: number | string | null }>
  currency?: string
}

function shortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`
}

function toRevenueValue(value: number | string | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toCountValue(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function SalesTrendChart({
  title,
  noDataText,
  data,
  currency = 'SEK',
}: SalesTrendChartProps) {
  const normalizedData = data.map((d) => ({
    date: d.date,
    revenue: toRevenueValue(d.revenue),
    ticketsSold: toCountValue(d.ticketsSold),
  }))
  const maxRevenue = Math.max(...normalizedData.map((d) => d.revenue), 1)
  const hasData = normalizedData.some((d) => d.revenue > 0 || d.ticketsSold > 0)
  const periodTotal = normalizedData.reduce((s, d) => s + d.revenue, 0)
  const salesDays = normalizedData.filter((d) => d.revenue > 0 || d.ticketsSold > 0).length
  const avgPerDay = normalizedData.length > 0 ? periodTotal / normalizedData.length : 0
  const peakDay =
    normalizedData.length > 0
      ? normalizedData.reduce((max, d) => (d.revenue > max.revenue ? d : max), normalizedData[0])
      : null

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {hasData && (
          <span className="shrink-0 text-sm font-medium text-gray-700">
            {formatCurrency(periodTotal, currency)}
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="mt-3 text-sm text-gray-500">{noDataText}</p>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Avg / Day</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {formatCurrency(avgPerDay, currency)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Best Day</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {peakDay
                  ? `${shortDate(peakDay.date)} • ${formatCurrency(peakDay.revenue, currency)}`
                  : '-'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Days with Sales</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {salesDays} / {normalizedData.length}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <span>{formatCurrency(0, currency)}</span>
            <span>{formatCurrency(maxRevenue, currency)}</span>
          </div>

          {/* Bars */}
          <div className="flex items-end gap-px h-28 sm:h-36 pt-2">
            {normalizedData.map(({ date, revenue, ticketsSold }) => (
              <div key={date} className="group relative flex-1 min-w-0 h-full flex flex-col justify-end">
                <div
                  className="w-full rounded-t-sm transition-all duration-200 ease-out cursor-default group-hover:opacity-90"
                  style={{
                    height:
                      revenue > 0
                        ? `${Math.max((revenue / maxRevenue) * 100, 6)}%`
                        : '2px',
                    backgroundColor: revenue > 0 ? '#5c8bd9' : '#f3f4f6',
                  }}
                  aria-label={ticketsSold > 0
                    ? `${shortDate(date)}: ${formatCurrency(revenue, currency)}, ${ticketsSold} ${ticketsSold === 1 ? 'ticket' : 'tickets'} sold`
                    : undefined}
                />
                {ticketsSold > 0 && (
                  <div className="pointer-events-none absolute bottom-[calc(100%-4px)] left-1/2 z-20 w-max -translate-x-1/2 translate-y-1 scale-95 rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-sm transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
                    <p className="font-medium">{shortDate(date)}</p>
                    <p>{formatCurrency(revenue, currency)}</p>
                    <p>{ticketsSold} {ticketsSold === 1 ? 'ticket' : 'tickets'} sold</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Date labels: first and last */}
          {normalizedData.length > 0 && (
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">{shortDate(normalizedData[0].date)}</span>
              <span className="text-xs text-gray-400">
                {shortDate(normalizedData[normalizedData.length - 1].date)}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
