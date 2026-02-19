import { notFound, redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EventForm } from '@/components/events/EventForm'
import { AgendaEditor } from '@/components/events/AgendaEditor'
import { SpeakerEditor } from '@/components/events/SpeakerEditor'
import { EventStatusActions } from '@/components/events/EventStatusActions'

export const dynamic = 'force-dynamic'

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
    },
  })

  if (!event) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>

      <EventStatusActions eventId={event.id} status={event.status} />

      <EventForm
        mode="edit"
        initialData={{
          id: event.id,
          title: event.title,
          description: event.description,
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
          visibility: event.visibility,
          cancellationDeadlineHours: event.cancellationDeadlineHours,
          categoryIds: event.categories.map((item) => item.categoryId),
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpeakerEditor
          eventId={event.id}
          initialSpeakers={event.speakers.map((speaker) => ({
            id: speaker.id,
            name: speaker.name,
            title: speaker.title,
            bio: speaker.bio,
            photo: speaker.photo,
            sortOrder: speaker.sortOrder,
          }))}
        />
        <AgendaEditor
          eventId={event.id}
          speakers={event.speakers.map((speaker) => ({ id: speaker.id, name: speaker.name }))}
          initialItems={event.agendaItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            startTime: item.startTime,
            endTime: item.endTime,
            speakerId: item.speakerId,
            sortOrder: item.sortOrder,
          }))}
        />
      </div>
    </div>
  )
}
