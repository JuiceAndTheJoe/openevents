import { formatCurrency } from '@/lib/utils'

type DashboardStatsProps = {
  stats: {
    totalEvents: number
    publishedEvents: number
    draftEvents: number
    upcomingEvents: number
    totalTicketsSold: number
    totalRevenue: number
  }
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards = [
    { label: 'Total Events', value: String(stats.totalEvents) },
    { label: 'Published', value: String(stats.publishedEvents) },
    { label: 'Draft', value: String(stats.draftEvents) },
    { label: 'Upcoming', value: String(stats.upcomingEvents) },
    { label: 'Tickets Sold', value: String(stats.totalTicketsSold) },
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue) },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
