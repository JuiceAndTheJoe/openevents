import Link from 'next/link'
import { prisma } from '@/lib/db'
import { WorkspacePageHeader, WorkspaceStatsGrid } from '@/components/layout/WorkspaceShell'

export const dynamic = 'force-dynamic'

export default async function DashboardAdminOverviewPage() {
  const [totalUsers, organizerCount, totalEvents] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.userRole.count({ where: { role: 'ORGANIZER' } }),
    prisma.event.count({ where: { deletedAt: null } }),
  ])

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        title="Admin Overview"
        description="Platform-wide statistics and user management."
        actions={(
          <Link
            href="/dashboard/admin/users"
            className="inline-flex rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Manage Users
          </Link>
        )}
      />

      <WorkspaceStatsGrid
        columns={3}
        items={[
          { label: 'Total Users', value: totalUsers },
          { label: 'Organizers', value: organizerCount },
          { label: 'Total Events', value: totalEvents },
        ]}
      />
    </div>
  )
}
