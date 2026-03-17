import Link from 'next/link'
import { EventStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AdminEventsTable } from '@/components/admin/AdminEventsTable'
import { WorkspacePageHeader, WorkspaceStatsGrid } from '@/components/layout/WorkspaceShell'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function param(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function DashboardAdminOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams

  const status = param(params.status) as EventStatus | undefined
  const query = param(params.q)
  const organizerId = param(params.organizerId)
  const page = parseInt(param(params.page) || '1', 10)
  const pageSize = 20

  const where: Prisma.EventWhereInput = {
    deletedAt: null,
  }

  if (status && ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'].includes(status)) {
    where.status = status
  }

  if (organizerId) {
    where.organizerId = organizerId
  }

  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { organizer: { orgName: { contains: query, mode: 'insensitive' } } },
    ]
  }

  const [totalUsers, organizerCount, totalEvents, events, filteredCount, organizers] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.userRole.count({ where: { role: 'ORGANIZER' } }),
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.event.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        startDate: true,
        endDate: true,
        status: true,
        visibility: true,
        organizer: {
          select: {
            id: true,
            orgName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        ticketTypes: {
          select: {
            soldCount: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
    prisma.organizerProfile.findMany({
      where: {
        events: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        orgName: true,
      },
      orderBy: { orgName: 'asc' },
    }),
  ])

  const eventsWithTicketsSold = events.map((event) => ({
    ...event,
    ticketsSold: event.ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0),
  }))

  const totalPages = Math.ceil(filteredCount / pageSize)

  function buildUrl(newParams: Record<string, string | undefined>) {
    const merged = {
      status: status || '',
      q: query || '',
      organizerId: organizerId || '',
      page: String(page),
      ...newParams,
    }
    const urlParams = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== '1' && !(key === 'q' && value === '') && !(key === 'status' && value === '') && !(key === 'organizerId' && value === '')) {
        urlParams.set(key, value)
      }
    }
    const qs = urlParams.toString()
    return `/dashboard/admin${qs ? `?${qs}` : ''}`
  }

  function buildExportUrl() {
    const urlParams = new URLSearchParams()
    if (status) urlParams.set('status', status)
    if (organizerId) urlParams.set('organizerId', organizerId)
    if (query) urlParams.set('q', query)
    const qs = urlParams.toString()
    return `/api/admin/events/export${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        title="Admin Overview"
        description="Platform-wide statistics and centralized event management."
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Events</h2>
        </div>

        <form className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <label htmlFor="q" className="text-xs font-medium text-gray-600">
              Search by title or organizer
            </label>
            <input
              id="q"
              name="q"
              defaultValue={query || ''}
              className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="status" className="text-xs font-medium text-gray-600">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status || ''}
              className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
          <div>
            <label htmlFor="organizerId" className="text-xs font-medium text-gray-600">
              Organizer
            </label>
            <select
              id="organizerId"
              name="organizerId"
              defaultValue={organizerId || ''}
              className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">All Organizers</option>
              {organizers.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.orgName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-10 rounded-md bg-[#5C8BD9] px-4 text-sm font-medium text-white hover:bg-[#4a7ac8]"
            >
              Apply
            </button>
            <a
              href={buildExportUrl()}
              className="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </a>
          </div>
        </form>

        <p className="text-sm text-gray-600">
          Showing {eventsWithTicketsSold.length} of {filteredCount} events
        </p>

        <AdminEventsTable events={eventsWithTicketsSold} />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
