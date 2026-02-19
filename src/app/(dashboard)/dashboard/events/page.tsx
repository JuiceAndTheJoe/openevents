import Link from 'next/link'
import { EventStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { EventsTable } from '@/components/dashboard/EventsTable'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function param(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function OrganizerEventsPage({ searchParams }: PageProps) {
  const { organizerProfile } = await requireOrganizerProfile()
  const params = await searchParams

  const status = param(params.status) as EventStatus | undefined
  const query = param(params.q)

  const where: Prisma.EventWhereInput = {
    organizerId: organizerProfile.id,
  }

  if (status && ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'].includes(status)) {
    where.status = status
  }

  if (query) {
    where.title = {
      contains: query,
      mode: 'insensitive',
    }
  }

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
      _count: {
        select: {
          orders: true,
          ticketTypes: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Events</h1>
          <p className="text-gray-600">Search, filter, and manage all organizer events.</p>
        </div>
        <Link href="/create-event" className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Create New Event
        </Link>
      </div>

      <form className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label htmlFor="q" className="text-xs font-medium text-gray-600">Search by title</label>
          <input id="q" name="q" defaultValue={query || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="status" className="text-xs font-medium text-gray-600">Status</label>
          <select id="status" name="status" defaultValue={status || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm">
            <option value="">All</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white">Apply</button>
        </div>
      </form>

      <EventsTable events={events} />
    </div>
  )
}
