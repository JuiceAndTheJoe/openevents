'use client'

import Link from 'next/link'
import { EventStatus, EventVisibility, LocationType } from '@prisma/client'
import { Calendar, MapPin, Heart } from 'lucide-react'
import { formatEventPrice, formatEventDateTime } from '@/lib/utils'

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
    ticketTypes: Array<{ price: number; currency: string }>
    organizer: { orgName: string }
  }
}

export function EventCard({ event }: EventCardProps) {
  // Price display using unified utility
  const priceDisplay = formatEventPrice(event.ticketTypes)

  // Location display
  let locationDisplay: string
  if (event.locationType === 'ONLINE') {
    locationDisplay = 'Online event'
  } else {
    const parts = [event.venue, event.city].filter(Boolean)
    locationDisplay = parts.join(', ') || 'Location TBD'
  }

  // Locale-aware date formatting with timezone
  const formattedDate = formatEventDateTime(event.startDate)

  return (
    <Link
      href={`/events/${event.slug}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      aria-label={`View event: ${event.title}`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#f2f2f4] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-lg">
        {/* Image section */}
        <div className="relative h-[200px] w-full shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600">
          {event.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/events/${encodeURIComponent(event.slug)}/image?slot=cover`}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]"
            aria-label="Add to favourites"
          >
            <Heart className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content section */}
        <div className="flex flex-col gap-3 px-5 pt-5 pb-5">
          <h3
            className="text-[20px] font-bold leading-7 text-black"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            {event.title}
          </h3>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0 text-[#364153]" />
              <span className="text-[16px] leading-6 text-[#364153]">
                {formattedDate}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-[#364153]" />
              <span className="text-[16px] leading-6 text-[#364153]">
                {locationDisplay}
              </span>
            </div>
            {priceDisplay && (
              <span
                className="text-[16px] font-semibold leading-6 text-[#5c8bd9]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                {priceDisplay}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
