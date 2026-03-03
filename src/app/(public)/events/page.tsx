import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { EventFilters } from '@/components/events/EventFilters'
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

  const category = readParam(params.category)
  const search = readParam(params.search)
  const location = readParam(params.location)
  const startDateParam = readParam(params.startDate)
  const endDateParam = readParam(params.endDate)
  const page = Math.max(Number(readParam(params.page) || '1'), 1)
  const pageSize = 9
  const now = new Date()

  const where: Prisma.EventWhereInput = {
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    deletedAt: null,
    endDate: { gte: now }, // Exclude past events
  }

  if (category) {
    where.categories = {
      some: {
        OR: [
          { category: { id: category } },
          { category: { slug: category } },
          { category: { name: { equals: category, mode: 'insensitive' } } },
        ],
      },
    }
  }

  if (search) {
    where.AND = [
      {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      },
    ]
  }

  if (location) {
    where.OR = [
      { venue: { contains: location, mode: 'insensitive' } },
      { city: { contains: location, mode: 'insensitive' } },
      { state: { contains: location, mode: 'insensitive' } },
      { country: { contains: location, mode: 'insensitive' } },
    ]
  }

  if (startDateParam || endDateParam) {
    where.startDate = {
      gte: startDateParam ? new Date(startDateParam) : undefined,
      lte: endDateParam ? new Date(endDateParam) : undefined,
    }
  }

  const [events, total, categories] = await prisma.$transaction([
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
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ])

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)

  const buildPageHref = (targetPage: number) => {
    const q = new URLSearchParams()
    if (category) q.set('category', category)
    if (search) q.set('search', search)
    if (location) q.set('location', location)
    if (startDateParam) q.set('startDate', startDateParam)
    if (endDateParam) q.set('endDate', endDateParam)
    q.set('page', String(targetPage))
    return `/events?${q.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Discover Events</h1>
        <p className="mt-2 text-gray-600">Find events by category, date, and location.</p>
      </div>

      <EventFilters
        categories={categories}
        initial={{
          search,
          category,
          location,
          startDate: startDateParam,
          endDate: endDateParam,
        }}
      />

      <EventList events={events} />

      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">
          {`Page ${page} of ${totalPages}`}
        </p>
        <div className="flex gap-2">
          <Link
            href={buildPageHref(Math.max(1, page - 1))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            Previous
          </Link>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  )
}
