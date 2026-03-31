import { formatCurrency } from '@/lib/utils'
import { WorkspaceStatsGrid } from '@/components/layout/WorkspaceShell'

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
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue), subtitle: 'Excluding invoice and free orders' },
  ]

  return <WorkspaceStatsGrid items={cards} columns={3} />
}
