import { EventCard } from '@/components/events/EventCard'
import { ShowcaseEventCard } from '@/components/events/ShowcaseEventCard'
import { EventCarousel } from '@/components/events/EventCarousel'
import { EventStatus, EventVisibility, LocationType, Prisma } from '@prisma/client'

type EventListProps = {
  events: Array<{
    id: string
    title: string
    slug: string
    description: string | null
    startDate: Date
    endDate: Date
    locationType: LocationType
    venue: string | null
    city: string | null
    country: string | null
    onlineUrl: string | null
    coverImage: string | null
    visibility: EventVisibility
    status: EventStatus
    organizer: { orgName: string }
    ticketTypes: Array<{ price: Prisma.Decimal; currency: string }>
  }>
  layout?: 'grid' | 'showcase' | 'carousel'
  emptyStateMessage?: string
}

export function EventList({ events, layout = 'grid', emptyStateMessage }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-gray-900 font-medium">No events found</p>
        <p className="mt-1 text-sm text-gray-500">
          {emptyStateMessage ?? 'No events are currently scheduled. Check back soon.'}
        </p>
      </div>
    )
  }

  // Normalize ticket prices to numbers for card components
  const normalizedEvents = events.map((event) => ({
    ...event,
    ticketTypes: event.ticketTypes.map((t) => ({
      price: t.price.toNumber(),
      currency: t.currency,
    })),
  }))

  if (layout === 'carousel') {
    return <EventCarousel events={normalizedEvents} />
  }

  if (layout === 'showcase') {
    if (normalizedEvents.length === 1) {
      return (
        <div className="max-w-3xl mx-auto">
          <ShowcaseEventCard event={normalizedEvents[0]} size="full" />
        </div>
      )
    }

    if (normalizedEvents.length === 2) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {normalizedEvents.map((event) => (
            <ShowcaseEventCard key={event.id} event={event} size="half" />
          ))}
        </div>
      )
    }

    // 3+ events: first is full-width hero, rest are regular EventCards
    const [heroEvent, ...remainingEvents] = normalizedEvents
    return (
      <div className="flex flex-col gap-6">
        <ShowcaseEventCard event={heroEvent} size="full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {remainingEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {normalizedEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
