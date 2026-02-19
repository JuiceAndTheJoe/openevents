import Link from 'next/link'
import { EventStatus, EventVisibility, LocationType } from '@prisma/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type EventCardProps = {
  event: {
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
    ticketTypes: Array<{ price: { toNumber: () => number }; currency: string }>
    organizer: { orgName: string }
  }
}

function getPriceRange(ticketTypes: EventCardProps['event']['ticketTypes']) {
  if (ticketTypes.length === 0) return 'No tickets yet'

  const prices = ticketTypes.map((ticket) => ticket.price.toNumber())
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const currency = ticketTypes[0]?.currency || 'EUR'

  if (min === max) {
    return `${currency} ${min.toFixed(2)}`
  }

  return `${currency} ${min.toFixed(2)} - ${max.toFixed(2)}`
}

function formatLocation(event: EventCardProps['event']) {
  if (event.locationType === 'ONLINE') return 'Online event'
  const parts = [event.venue, event.city, event.country].filter(Boolean)
  return parts.join(', ') || 'Location TBD'
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="h-44 w-full bg-gradient-to-r from-blue-500 to-indigo-600">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <CardHeader>
        <CardTitle className="text-xl">{event.title}</CardTitle>
        <p className="text-sm text-gray-600">by {event.organizer.orgName}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-gray-700">
        <p>{new Date(event.startDate).toLocaleString()}</p>
        <p>{formatLocation(event)}</p>
        <p>{getPriceRange(event.ticketTypes)}</p>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {event.visibility}
        </span>
        <Link href={`/events/${event.slug}`}>
          <Button size="sm">View Event</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
