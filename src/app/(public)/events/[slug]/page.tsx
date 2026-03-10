import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, ExternalLink, Globe, MapPin, Pencil } from 'lucide-react'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EventNoticeToast } from '@/components/events/EventNoticeToast'
import { CHECKOUT_UNAVAILABLE_NOTICE } from '@/lib/orders/checkoutAvailability'
import { isValidTimeZone } from '@/lib/timezone'
import { getPriceIncludingVat } from '@/lib/pricing/vat'
import { getVatRateForCountryNameOrCode } from '@/lib/pricing/vatRates'
import { formatEventPrice, formatEventDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ notice?: string | string[] }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
          socialLinks: true,
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

  // Filter out empty/dash-only values for location (#209)
  const locationParts = [event.venue, event.address, event.city, event.state, event.country]
    .filter((part) => part && part.trim() && part.trim() !== '-')
  const locationText = locationParts.join(', ')

  const mapQuery = encodeURIComponent(locationText || event.title)
  const mapEmbedUrl = `https://www.google.com/maps?q=${mapQuery}&output=embed`

  const eventVatRate = getVatRateForCountryNameOrCode(event.country ?? '')
  const ticketTypesWithVat = event.ticketTypes.map((ticketType) => ({
    ...ticketType,
    price: getPriceIncludingVat(Number(ticketType.price), eventVatRate),
  }))
  const priceDisplay = formatEventPrice(ticketTypesWithVat)
  const hasPaidTickets = event.ticketTypes.some((ticketType) => Number(ticketType.price) > 0)
  const bottomImage = event.media.find((item) => item.title === 'BOTTOM_IMAGE')?.url || null
  const coverImageSrc = `/api/events/${encodeURIComponent(event.slug)}/image?slot=cover&v=${event.updatedAt.getTime()}`
  const bottomImageSrc = `/api/events/${encodeURIComponent(event.slug)}/image?slot=bottom&v=${event.updatedAt.getTime()}`

  // Date formatting with timezone (#212)
  const displayTimeZone = isValidTimeZone(event.timezone) ? event.timezone : 'UTC'
  const startDateTimeLabel = formatEventDateTime(event.startDate, displayTimeZone)
  const endDateTimeLabel = formatEventDateTime(event.endDate, displayTimeZone)
  const startDateKey = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: displayTimeZone,
  }).format(event.startDate)
  const endDateKey = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: displayTimeZone,
  }).format(event.endDate)
  const isSameLocalDay = startDateKey === endDateKey
  const rightDateTimeLabel = isSameLocalDay
    ? startDateTimeLabel
    : `${startDateTimeLabel} - ${endDateTimeLabel}`
  const notice = firstQueryValue(query.notice)
  const noticeMessage = notice === 'created'
    ? 'Event created'
    : notice === 'updated'
      ? 'Event updated'
      : null
  const checkoutUnavailableMessage =
    notice === CHECKOUT_UNAVAILABLE_NOTICE.EVENT_NOT_PUBLISHED
      ? 'Checkout is unavailable because this event is not open for ticket sales.'
      : notice === CHECKOUT_UNAVAILABLE_NOTICE.EVENT_STARTED
        ? 'Checkout is unavailable because this event has already started.'
        : notice === CHECKOUT_UNAVAILABLE_NOTICE.NO_PURCHASABLE_TICKETS
          ? 'Checkout is unavailable because there are no tickets currently on sale.'
          : null

  // Get organizer website from either website field or socialLinks
  const organizerWebsite = event.organizer.website ||
    (isRecord(event.organizer.socialLinks) ? (event.organizer.socialLinks.website as string | null) : null)

  type PersonCard = { id: string; name: string; title: string | null; photo: string | null; organization: string | null; link: string | null }
  const speakers: PersonCard[] = event.speakers.map((person) => ({
    id: person.id,
    name: person.name,
    title: person.title,
    photo: person.photo,
    organization:
      isRecord(person.socialLinks) && person.socialLinks.__kind === 'EVENT_PEOPLE'
        ? (person.socialLinks.organization as string | null) || null
        : null,
    link:
      isRecord(person.socialLinks) && person.socialLinks.__kind === 'EVENT_PEOPLE'
        ? (person.socialLinks.link as string | null) || null
        : null,
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
      <EventNoticeToast message={noticeMessage} />
      {checkoutUnavailableMessage && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {checkoutUnavailableMessage}
        </div>
      )}
      {event.coverImage ? (
        <section className="relative overflow-hidden rounded-2xl bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageSrc}
            alt={event.title}
            className="aspect-video w-full object-cover"
          />
        </section>
      ) : null}

      <section className="border-b border-[#bfbfbf] pb-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-10">

          {/* Left column: event info */}
          <div className="flex flex-1 flex-col gap-[14px]">
            <h1
              className="text-4xl font-bold leading-none text-black sm:text-5xl lg:text-[56px]"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              {event.title}
            </h1>
            <div className="flex items-center gap-2">
              <p
                className="text-[20px] text-black"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                By <span className="font-semibold">{event.organizer.orgName}</span>
              </p>
              {organizerWebsite && (
                <a
                  href={organizerWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5c8bd9] transition hover:text-[#4a7ac8]"
                  aria-label="Visit organizer website"
                >
                  <Globe className="h-5 w-5" />
                </a>
              )}
            </div>
            <div className="flex flex-col gap-[12px]">
              {event.locationType !== 'ONLINE' ? (
                <div className="flex items-start gap-[16px]">
                  <MapPin className="mt-1 h-6 w-6 shrink-0 text-[#364153]" />
                  <div className="flex flex-col">
                    {event.venue && (
                      <span
                        className="text-[18px] font-semibold leading-7 text-[#364153]"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        {event.venue}
                      </span>
                    )}
                    {locationText && (
                      <span
                        className="text-[17px] font-normal leading-7 text-[#4a5565]"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        {locationText}
                      </span>
                    )}
                    {!event.venue && !locationText && (
                      <span
                        className="text-[18px] font-semibold leading-7 text-[#364153]"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        Location TBD
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-[16px]">
                  <MapPin className="h-6 w-6 shrink-0 text-[#364153]" />
                  <span
                    className="text-[18px] font-semibold text-[#364153]"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    Online event
                  </span>
                </div>
              )}
              <div className="flex items-center gap-[12px]">
                <Calendar className="h-7 w-7 shrink-0 text-[#364153]" />
                <span
                  className="text-[17px] leading-7 text-[#364153]"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  {startDateTimeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Right column: edit button (top-right) + price section */}
          <div className="flex w-full flex-col lg:w-[320px] lg:shrink-0">

            {/* Edit button — only shown to the event owner or super admin */}
            {isOwnerOrAdmin ? (
              <Link
                href={`/dashboard/events/${event.id}/edit`}
                className="flex w-fit items-center gap-2 self-end rounded-[50px] bg-[#e5e7eb] py-2 pl-4 pr-4 transition hover:bg-[#d1d5db]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                <Pencil className="h-5 w-5 text-[#4a5565]" />
                <span className="text-[16px] font-semibold leading-6 text-[#4a5565]">Edit</span>
              </Link>
            ) : (
              <div className="h-10" />
            )}

            {/* Price — 2px below edit button, height 36px */}
            <p
              className="mt-0.5 text-[24px] font-bold leading-[30px] text-[#5c8bd9]"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              {priceDisplay || 'Free'}
            </p>
            {hasPaidTickets ? (
              <p
                className="mt-1 text-[13px] leading-5 text-[#4a5565]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                VAT included ({Math.round(eventVatRate * 100)}%).
              </p>
            ) : null}

            {/* Date and time */}
            <p
              className="mt-1 text-[15px] leading-6 text-[#364153]"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              {rightDateTimeLabel}
            </p>

            {/* Get tickets — 16px below time */}
            {event.status === 'PUBLISHED' ? (
              <Link
                href={`/events/${event.slug}/checkout`}
                className="mt-4 flex h-[52px] items-center justify-center rounded-[12px] bg-[#5c8bd9] text-[18px] font-semibold text-white transition hover:bg-[#4a7ac8]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Get tickets
              </Link>
            ) : (
              <span className="mt-4 flex h-[52px] items-center justify-center rounded-[12px] border border-gray-300 bg-white text-[18px] font-semibold text-gray-500">
                Draft preview
              </span>
            )}
          </div>

        </div>
      </section>

      <section className="border-b border-gray-300 pb-8">
        <h2
          className="text-[28px] font-bold leading-[34px] text-black"
          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
        >
          Overview
        </h2>
        <div
          className={`mt-4 grid grid-cols-1 gap-6 ${
            event.locationType !== 'ONLINE' ? 'lg:grid-cols-[1fr_280px]' : ''
          }`}
        >
          <div>
            {event.description?.trim() ? (
              <p
                className="whitespace-pre-line text-[18px] leading-[29.25px] text-[#364153]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                {event.description}
              </p>
            ) : event.descriptionHtml ? (
              <div
                className="prose max-w-none text-[18px] leading-[29.25px] text-[#364153]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
              />
            ) : (
              <p
                className="text-[18px] leading-[29.25px] text-[#364153]"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Event details will be announced soon.
              </p>
            )}
          </div>

          {event.locationType !== 'ONLINE' ? (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <iframe
                title="Event location map"
                src={mapEmbedUrl}
                className="h-[230px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </div>
      </section>

      {event.website && (
        <section className="border-b border-gray-300 pb-8">
          <a
            href={event.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#5c8bd9] transition hover:text-[#4a7ac8]"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            <ExternalLink className="h-5 w-5" />
            <span className="text-[18px] underline">Read more about {event.title} on the event website</span>
          </a>
        </section>
      )}

      {speakers.length > 0 ? (
        <section className="border-b border-[#bfbfbf] pb-8">
          <h2
            className="text-[30px] font-bold leading-[36px] text-black"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Speakers
          </h2>
          <div className="mt-6 flex flex-wrap gap-6">
            {speakers.map((person) => (
              <div
                key={person.id}
                className="flex h-[104px] w-[302px] shrink-0 items-center gap-4 rounded-[14px] bg-[#f9fafb] pl-4 pr-4"
              >
                {/* Avatar */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb]">
                  {person.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/speakers/${person.id}/image`}
                      alt={person.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-[24px] font-bold leading-8 text-[#4a5565]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    {person.link ? (
                      <a
                        href={person.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[18px] font-semibold leading-[28px] text-[#5c8bd9] underline transition hover:text-[#4a7ac8]"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        {person.name}
                      </a>
                    ) : (
                      <span
                        className="text-[18px] font-semibold leading-[28px] text-black"
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                      >
                        {person.name}
                      </span>
                    )}
                  </div>
                  {person.title && (
                    <span
                      className="text-[16px] font-normal leading-[24px] text-[#364153]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      {person.title}
                    </span>
                  )}
                  {person.organization && (
                    <span
                      className="text-[14px] font-normal leading-[20px] text-[#4a5565]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      {person.organization}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {bottomImage ? (
        <section className="overflow-hidden rounded-none bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bottomImageSrc}
            alt={`${event.title} visual`}
            className="aspect-video w-full object-cover"
          />
        </section>
      ) : null}
    </div>
  )
}
