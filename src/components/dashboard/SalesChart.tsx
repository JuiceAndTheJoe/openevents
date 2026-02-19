import { formatCurrency } from '@/lib/utils'

type SalesChartProps = {
  title?: string
  data: Array<{
    label: string
    value: number
  }>
  currency?: string
}

export function SalesChart({ title = 'Sales Breakdown', data, currency = 'SEK' }: SalesChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 0)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">No sales data yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.label}</span>
                <span className="font-medium text-gray-900">{formatCurrency(item.value, currency)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${maxValue === 0 ? 0 : (item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
