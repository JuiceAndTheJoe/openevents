import { getTranslations } from 'next-intl/server'
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

export async function DashboardStats({ stats }: DashboardStatsProps) {
  const t = await getTranslations('dashboard.stats')

  const cards = [
    { label: t('totalEvents'), value: String(stats.totalEvents) },
    { label: t('published'), value: String(stats.publishedEvents) },
    { label: t('draft'), value: String(stats.draftEvents) },
    { label: t('upcoming'), value: String(stats.upcomingEvents) },
    { label: t('ticketsSold'), value: String(stats.totalTicketsSold) },
    { label: t('revenue'), value: formatCurrency(stats.totalRevenue) },
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
