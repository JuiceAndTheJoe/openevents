import Link from 'next/link'
import { EventStatus, EventVisibility, LocationType } from '@prisma/client'
import { Calendar, MapPin } from 'lucide-react'
import { getPriceIncludingVat } from '@/lib/pricing/vat'
import { formatEventPrice, formatEventDateTime } from '@/lib/utils'

type ShowcaseEventCardProps = {
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
  size?: 'full' | 'half'
}

export function ShowcaseEventCard({ event, size = 'full' }: ShowcaseEventCardProps) {
  // Price display uses VAT-inclusive values (25% VAT).
  const ticketTypesWithVat = event.ticketTypes.map((ticketType) => ({
    ...ticketType,
    price: getPriceIncludingVat(Number(ticketType.price)),
  }))
  const priceDisplay = formatEventPrice(ticketTypesWithVat)
  const hasPaidTickets = event.ticketTypes.some((ticketType) => Number(ticketType.price) > 0)

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

  const aspectClass =
    size === 'full'
      ? 'aspect-[4/3] sm:aspect-[21/9]'
      : 'aspect-[4/3]'

  return (
    <Link
      href={`/events/${event.slug}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      aria-label={`View event: ${event.title}`}
    >
      <div
        className={`relative ${aspectClass} min-h-[300px] w-full overflow-hidden rounded-2xl`}
      >
        {/* Background: image or fallback gradient */}
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/events/${encodeURIComponent(event.slug)}/image?slot=cover`}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#5C8BD9] to-[#3a5fa8]" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Content pinned to bottom */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6">
          {/* Date badge */}
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm border border-white/20">
            <Calendar className="h-3 w-3 shrink-0 text-white/80" />
            <span className="text-xs uppercase tracking-widest text-white/80">
              {formattedDate}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-3xl sm:text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            {event.title}
          </h3>

          {/* Location and price row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-white/80" />
              <span className="text-sm text-white/80">{locationDisplay}</span>
            </div>
            {priceDisplay && (
              <span
                className="text-sm font-semibold text-white/90"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                {priceDisplay}
                {hasPaidTickets ? ' (incl. VAT)' : ''}
              </span>
            )}
          </div>

          {/* CTA button */}
          <div>
            <span className="inline-block rounded-full bg-[#5C8BD9] px-6 py-3 text-white font-semibold text-sm">
              Get tickets →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
