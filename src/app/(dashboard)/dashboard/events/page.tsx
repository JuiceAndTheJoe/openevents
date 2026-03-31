import Link from 'next/link'
import { EventStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause } from '@/lib/dashboard/organizer'
import { EventsTable } from '@/components/dashboard/EventsTable'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function param(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function OrganizerEventsPage({ searchParams }: PageProps) {
  await requireOrganizerProfile()
  const params = await searchParams

  const status = param(params.status) as EventStatus | undefined
  const query = param(params.q)

  const additionalWhere: Prisma.EventWhereInput = {}

  if (status && ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'].includes(status)) {
    additionalWhere.status = status
  }

  if (query) {
    additionalWhere.title = {
      contains: query,
      mode: 'insensitive',
    }
  }

  const where = buildEventWhereClause(null, true, additionalWhere)

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      startDate: true,
      endDate: true,
      status: true,
      visibility: true,
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
    orderBy: {
      startDate: 'desc',
    },
  })

  const eventsWithTicketsSold = events.map((event) => ({
    ...event,
    ticketsSold: event.ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">Search, filter, and manage all events.</p>
        </div>
        <Link href="/create-event" className="inline-flex rounded-md bg-[#5C8BD9] px-4 py-2 text-sm font-medium text-white">
          Create New Event
        </Link>
      </div>

      <form className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label htmlFor="q" className="text-xs font-medium text-gray-600">Search by title</label>
          <div className="mt-1">
            <Input id="q" name="q" defaultValue={query || ''} placeholder="Search events..." />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="text-xs font-medium text-gray-600">Status</label>
          <select id="status" name="status" defaultValue={status || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="h-10 rounded-md bg-[#5C8BD9] px-4 text-sm font-medium text-white">Apply</button>
        </div>
      </form>

      <EventsTable events={eventsWithTicketsSold} />
    </div>
  )
}
