import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heart, MapPin } from 'lucide-react'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EventNoticeToast } from '@/components/events/EventNoticeToast'
import { DEFAULT_CURRENCY } from '@/lib/constants/currencies'
import { isValidTimeZone } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ notice?: string | string[] }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolvePeopleRole(person: { title: string | null; socialLinks: unknown }) {
  if (isRecord(person.socialLinks)) {
    const markerKind = person.socialLinks.__kind
    const markerRole = person.socialLinks.role
    if (markerKind === 'EVENT_PEOPLE' && (markerRole === 'SPEAKER' || markerRole === 'ORGANIZER' || markerRole === 'SPONSOR')) {
      return markerRole
    }
  }

  const normalizedTitle = (person.title || '').toLowerCase()
  if (normalizedTitle.includes('sponsor')) return 'SPONSOR'
  if (normalizedTitle.includes('organizer') || normalizedTitle.includes('organiser')) return 'ORGANIZER'
  return 'SPEAKER'
}

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function EventDetailsPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const user = await getCurrentUser()

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: {
        select: {
          userId: true,
          orgName: true,
          description: true,
          website: true,
        },
      },
      ticketTypes: {
        where: { isVisible: true },
        orderBy: { sortOrder: 'asc' },
      },
      speakers: {
        orderBy: { sortOrder: 'asc' },
      },
      media: {
        where: { type: 'IMAGE' },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const isOwnerOrAdmin = user
    ? hasRole(user.roles, ['ORGANIZER', 'SUPER_ADMIN']) &&
      (hasRole(user.roles, 'SUPER_ADMIN') || user.id === event.organizer.userId)
    : false

  if (event.status !== 'PUBLISHED' && !isOwnerOrAdmin) {
    notFound()
  }

  const locationText = [event.venue, event.address, event.city, event.state, event.country]
    .filter(Boolean)
    .join(', ')

  const mapQuery = encodeURIComponent(locationText || event.title)
  const mapEmbedUrl = `https://www.google.com/maps?q=${mapQuery}&output=embed`

  const minPrice = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((ticket) => Number(ticket.price)))
    : null
  const currency = event.ticketTypes[0]?.currency || DEFAULT_CURRENCY
  const bottomImage = event.media.find((item) => item.title === 'BOTTOM_IMAGE')?.url || null
  const coverImageSrc = `/api/events/${encodeURIComponent(event.slug)}/image?slot=cover&v=${event.updatedAt.getTime()}`
  const bottomImageSrc = `/api/events/${encodeURIComponent(event.slug)}/image?slot=bottom&v=${event.updatedAt.getTime()}`
  const priceSuffix = currency === 'SEK' ? 'kr' : currency

  const displayTimeZone = isValidTimeZone(event.timezone) ? event.timezone : 'UTC'
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    timeZone: displayTimeZone,
  }).format(event.startDate)
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: displayTimeZone,
    timeZoneName: 'short',
  }).format(event.startDate)
  const notice = firstQueryValue(query.notice)
  const noticeMessage = (() => {
    if (notice === 'created' || notice === 'updated') {
      return `Event ${notice}`
    }

    if (notice === 'checkout-unavailable-status') {
      return 'Checkout is unavailable because this event is not published.'
    }

    if (notice === 'checkout-unavailable-ended') {
      return 'Checkout is unavailable because this event has already started.'
    }

    if (notice === 'checkout-unavailable-sold-out') {
      return 'Checkout is unavailable because all ticket types are sold out.'
    }

    return null
  })()

  const speakerNames: string[] = []
  const organizerNames: string[] = []
  const sponsorNames: string[] = []

  for (const person of event.speakers) {
    const role = resolvePeopleRole(person)
    if (role === 'ORGANIZER') organizerNames.push(person.name)
    else if (role === 'SPONSOR') sponsorNames.push(person.name)
    else speakerNames.push(person.name)
  }

  const hasPeopleSections = speakerNames.length > 0 || organizerNames.length > 0 || sponsorNames.length > 0
  const canEditEvent = isOwnerOrAdmin

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <EventNoticeToast message={noticeMessage} />
      <section className="overflow-hidden rounded-xl border-4 border-blue-500 bg-gray-900">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageSrc}
            alt={event.title}
            className="h-[230px] w-full object-cover sm:h-[340px]"
          />
        ) : (
          <div className="h-[230px] bg-gradient-to-r from-slate-700 to-slate-900 sm:h-[340px]" />
        )}
      </section>

      <section className="border-b border-gray-300 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">{event.title}</h1>
            <p className="mt-1 text-xl text-gray-800">By {event.organizer.orgName}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-gray-800 transition hover:bg-gray-100"
            aria-label="Save event"
          >
            <Heart className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            {event.locationType !== 'ONLINE' ? (
              <p className="flex items-start gap-2 text-lg text-gray-900">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-7">{locationText || 'Location TBD'}</span>
              </p>
            ) : (
              <p className="text-lg text-gray-900">Online event</p>
            )}
            <p className="text-xl text-gray-900">
              {dateLabel} at {timeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4 border-t border-gray-300 pt-3 md:border-t-0 md:pt-0">
            <div>
              <p className="text-2xl font-medium text-gray-900">
                {minPrice === null ? 'Free / unavailable' : `From ${minPrice.toFixed(0)} ${priceSuffix}`}
              </p>
              <p className="text-xs text-gray-600">
                {dateLabel} at {timeLabel}
              </p>
            </div>
            {canEditEvent ? (
              <Link
                href={`/dashboard/events/${event.id}/edit`}
                className="inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Edit event
              </Link>
            ) : null}
            {event.status === 'PUBLISHED' ? (
              <Link
                href={`/events/${event.slug}/checkout`}
                className="inline-flex rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Get tickets
              </Link>
            ) : (
              <span className="inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-500">
                Draft preview
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-gray-300 pb-8">
        <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">Overview</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_270px]">
          <div className="text-lg leading-8 text-gray-900">
            {event.description?.trim() ? (
              <p className="whitespace-pre-line">{event.description}</p>
            ) : event.descriptionHtml ? (
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} />
            ) : (
              <p>Event details will be announced soon.</p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            {event.locationType === 'ONLINE' ? (
              <div className="flex h-[230px] items-center justify-center bg-gray-50 p-4 text-center text-sm text-gray-500">
                Online event map preview not required.
              </div>
            ) : (
              <iframe
                title="Event location map"
                src={mapEmbedUrl}
                className="h-[230px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
        </div>
      </section>

      {hasPeopleSections ? (
        <section className="border-b border-gray-300 pb-8">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">People</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            {speakerNames.length > 0 ? (
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900">Speakers</h3>
                <ul className="mt-3 space-y-2 text-gray-700">
                  {speakerNames.map((name) => (
                    <li key={`speaker-${name}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {organizerNames.length > 0 ? (
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900">Organizers</h3>
                <ul className="mt-3 space-y-2 text-gray-700">
                  {organizerNames.map((name) => (
                    <li key={`organizer-${name}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sponsorNames.length > 0 ? (
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900">Sponsors</h3>
                <ul className="mt-3 space-y-2 text-gray-700">
                  {sponsorNames.map((name) => (
                    <li key={`sponsor-${name}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {bottomImage ? (
        <section className="overflow-hidden rounded-none bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bottomImageSrc}
            alt={`${event.title} visual`}
            className="h-[230px] w-full object-cover sm:h-[340px]"
          />
        </section>
      ) : null}
    </div>
  )
}
