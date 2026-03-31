import { notFound } from 'next/navigation'
import { requireOrganizerProfile, buildEventWhereClause } from '@/lib/dashboard/organizer'
import { prisma } from '@/lib/db'
import { EventForm } from '@/components/events/EventForm'
import { EventStatusActions } from '@/components/events/EventStatusActions'

export const dynamic = 'force-dynamic'

type EventPeopleRole = 'SPEAKER' | 'ORGANIZER' | 'SPONSOR'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolveEventPeopleRole(socialLinks: unknown): EventPeopleRole | null {
  if (!isRecord(socialLinks)) return null

  const markerKind = socialLinks.__kind
  const markerRole = socialLinks.role
  if (markerKind !== 'EVENT_PEOPLE') return null
  if (markerRole === 'SPEAKER' || markerRole === 'ORGANIZER' || markerRole === 'SPONSOR') {
    return markerRole
  }

  return null
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditEventPage({ params }: PageProps) {
  const { id } = await params
  await requireOrganizerProfile()

  const event = await prisma.event.findFirst({
    where: buildEventWhereClause(null, true, { id }),
    include: {
      agendaItems: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        speakers: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        ticketTypes: {
          where: { isVisible: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        discountCodes: {
          include: {
            ticketTypes: {
              select: { ticketTypeId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        groupDiscounts: {
          orderBy: [{ minQuantity: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

  if (!event) {
    notFound()
  }

  const eventPeople = event.speakers.filter((speaker) => resolveEventPeopleRole(speaker.socialLinks))
  const bottomImage = event.media.find((item) => item.title === 'BOTTOM_IMAGE')?.url || ''

  const speakerPeople = eventPeople.filter((speaker) => resolveEventPeopleRole(speaker.socialLinks) === 'SPEAKER')
  const initialSpeakers = speakerPeople.map((speaker) => ({
    id: speaker.id,
    name: speaker.name,
    title: speaker.title || '',
    organization:
      isRecord(speaker.socialLinks) && speaker.socialLinks.__kind === 'EVENT_PEOPLE'
        ? String(speaker.socialLinks.organization || '')
        : '',
    photo: speaker.photo || '',
    link:
      isRecord(speaker.socialLinks) && speaker.socialLinks.__kind === 'EVENT_PEOPLE'
        ? String(speaker.socialLinks.link || '')
        : '',
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <EventStatusActions eventId={event.id} status={event.status} />

      <EventForm
        mode="edit"
        initialSpeakers={initialSpeakers}
        initialPromoCodes={event.discountCodes.map((dc) => ({
          id: dc.id,
          code: dc.code,
          discountType: dc.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_TICKET' | 'INVOICE',
          discountValue: Number(dc.discountValue).toString(),
          ticketTypeId: dc.ticketTypes[0]?.ticketTypeId ?? '',
          maxUses: dc.maxUses !== null ? String(dc.maxUses) : '',
          minCartAmount: dc.minCartAmount !== null ? String(Number(dc.minCartAmount)) : '',
        }))}
        initialGroupDiscounts={event.groupDiscounts.map((gd) => ({
          id: gd.id,
          ticketTypeId: gd.ticketTypeId ?? '',
          minQuantity: String(gd.minQuantity),
          discountType: gd.discountType as 'PERCENTAGE' | 'FIXED',
          discountValue: String(Number(gd.discountValue)),
          isActive: gd.isActive,
        }))}
        initialData={{
          id: event.id,
          slug: event.slug,
          status: event.status,
          ticketTypes: event.ticketTypes.map((ticketType) => ({
            id: ticketType.id,
            name: ticketType.name,
            price: Number(ticketType.price).toString(),
            currency: ticketType.currency,
            capacity: ticketType.maxCapacity ? String(ticketType.maxCapacity) : '',
          })),
          title: event.title,
          organization: event.organization,
          description: event.description || event.descriptionHtml || '',
          descriptionHtml: event.descriptionHtml,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
          timezone: event.timezone,
          locationType: event.locationType,
          venue: event.venue,
          address: event.address,
          city: event.city,
          state: event.state,
          country: event.country,
          postalCode: event.postalCode,
          onlineUrl: event.onlineUrl,
          coverImage: event.coverImage,
          website: event.website,
          bottomImage,
          visibility: event.visibility,
          cancellationDeadlineHours: event.cancellationDeadlineHours,
          collectAllergies: event.collectAllergies,
        }}
      />
    </div>
  )
}
