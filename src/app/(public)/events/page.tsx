import Link from 'next/link'
import { prisma } from '@/lib/db'
import { EventList } from '@/components/events/EventList'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined): string | undefined {
  const resolved = Array.isArray(value) ? value[0] : value

  if (typeof resolved !== 'string') {
    return undefined
  }

  const trimmed = resolved.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams

  const page = Math.max(Number(readParam(params.page) || '1'), 1)
  const pageSize = 9
  const now = new Date()

  const where = {
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    deletedAt: null,
    endDate: { gte: now },
  }

  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: {
        organizer: {
          select: {
            orgName: true,
          },
        },
        ticketTypes: {
          where: { isVisible: true },
          select: {
            price: true,
            currency: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ])

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)

  const buildPageHref = (targetPage: number) => {
    const q = new URLSearchParams()
    q.set('page', String(targetPage))
    return `/events?${q.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Upcoming Events</h1>
        <p className="mt-2 text-gray-600">Browse all upcoming events.</p>
      </div>

      <EventList events={events} layout="showcase" />

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          {`Page ${page} of ${totalPages}`}
        </p>
        <div className="flex gap-2 self-end sm:self-auto">
          {page <= 1 ? (
            <span className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-300 cursor-not-allowed select-none">
              Previous
            </span>
          ) : (
            <Link
              href={buildPageHref(page - 1)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              Previous
            </Link>
          )}
          {page >= totalPages ? (
            <span className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-300 cursor-not-allowed select-none">
              Next
            </span>
          ) : (
            <Link
              href={buildPageHref(page + 1)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
