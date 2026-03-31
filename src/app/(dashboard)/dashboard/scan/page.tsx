import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause } from '@/lib/dashboard/organizer'
import { EventStatusBadge } from '@/components/dashboard/EventStatusBadge'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardScanPage() {
  await requireOrganizerProfile()

  const where = buildEventWhereClause(null, true, {
    status: { notIn: ['DRAFT', 'CANCELLED'] },
    endDate: { gte: new Date() },
  })

  const events = await prisma.event.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: [
      { startDate: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Scan Tickets</h1>
        <p className="text-gray-600">Pick an event and open the scanner in one click.</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
          No events on the platform yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{event.title}</h2>
                <EventStatusBadge status={event.status} />
              </div>
              <p className="mt-2 text-sm text-gray-600">{formatDateTime(event.startDate)}</p>
              <p className="mt-1 text-xs text-gray-500">{`${event._count.orders} orders`}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/events/${event.id}/scan`}
                  className="inline-flex rounded-md bg-[#5C8BD9] px-3 py-2 text-sm font-semibold text-white hover:bg-[#4a7ac8]"
                >
                  Open Scanner
                </Link>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="inline-flex rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  View Event
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
