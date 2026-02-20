import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EventForm } from '@/components/events/EventForm'
import { EventStatusActions } from '@/components/events/EventStatusActions'
import { ProgramSection } from '@/components/events/ProgramSection'

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
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!hasRole(user.roles, 'ORGANIZER')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Organizer role is required to manage events.
        </div>
      </div>
    )
  }

  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })

  if (!organizer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Organizer profile not found.
        </div>
      </div>
    )
  }

  const event = await prisma.event.findFirst({
    where: {
      id,
      organizerId: organizer.id,
    },
    include: {
      categories: {
        select: {
          categoryId: true,
        },
      },
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
        where: { type: 'IMAGE' },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const eventPeople = event.speakers.filter((speaker) => resolveEventPeopleRole(speaker.socialLinks))
  const regularSpeakers = event.speakers.filter((speaker) => !resolveEventPeopleRole(speaker.socialLinks))
  const bottomImage = event.media.find((item) => item.title === 'BOTTOM_IMAGE')?.url || ''

  const speakerNames = eventPeople
    .filter((speaker) => resolveEventPeopleRole(speaker.socialLinks) === 'SPEAKER')
    .map((speaker) => speaker.name)
    .join(', ')
  const organizerNames = eventPeople
    .filter((speaker) => resolveEventPeopleRole(speaker.socialLinks) === 'ORGANIZER')
    .map((speaker) => speaker.name)
    .join(', ')
  const sponsorNames = eventPeople
    .filter((speaker) => resolveEventPeopleRole(speaker.socialLinks) === 'SPONSOR')
    .map((speaker) => speaker.name)
    .join(', ')
  const primaryTicketType = event.ticketTypes[0]

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>

      <EventStatusActions eventId={event.id} status={event.status} />

      <EventForm
        mode="edit"
        initialData={{
          id: event.id,
          slug: event.slug,
          ticketTypeId: primaryTicketType?.id || '',
          ticketTypeName: primaryTicketType?.name || 'General Admission',
          ticketPrice: primaryTicketType ? Number(primaryTicketType.price).toString() : '0',
          ticketCurrency: primaryTicketType?.currency || 'SEK',
          ticketCapacity: primaryTicketType?.maxCapacity ? String(primaryTicketType.maxCapacity) : '',
          title: event.title,
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
          bottomImage,
          speakerNames,
          organizerNames,
          sponsorNames,
          visibility: event.visibility,
          cancellationDeadlineHours: event.cancellationDeadlineHours,
          categoryIds: event.categories.map((item) => item.categoryId),
        }}
      >
        <ProgramSection
          eventId={event.id}
          speakers={regularSpeakers.map((speaker) => ({
            id: speaker.id,
            name: speaker.name,
            title: speaker.title,
            bio: speaker.bio,
            photo: speaker.photo,
            sortOrder: speaker.sortOrder,
          }))}
          agendaItems={event.agendaItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            startTime: item.startTime,
            endTime: item.endTime,
            speakerId: item.speakerId,
            sortOrder: item.sortOrder,
          }))}
        />
      </EventForm>
    </div>
  )
}
