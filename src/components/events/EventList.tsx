import { EventCard } from '@/components/events/EventCard'
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
}

export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600">
        No events found for the selected filters.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
