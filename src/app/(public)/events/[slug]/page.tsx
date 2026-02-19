import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { EventHero } from '@/components/events/EventHero'
import { EventInfo } from '@/components/events/EventInfo'
import { EventAgenda } from '@/components/events/EventAgenda'
import { EventSpeakers } from '@/components/events/EventSpeakers'
import { LocationMap } from '@/components/events/LocationMap'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function EventDetailsPage({ params }: PageProps) {
  const { slug } = await params

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: {
        select: {
          orgName: true,
          description: true,
          website: true,
        },
      },
      agendaItems: {
        include: {
          speaker: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
      },
      speakers: {
        orderBy: { sortOrder: 'asc' },
      },
      ticketTypes: {
        where: { isVisible: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!event || event.status !== 'PUBLISHED') {
    notFound()
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const eventUrl = `${appUrl}/events/${event.slug}`

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <EventHero
        title={event.title}
        description={event.description}
        coverImage={event.coverImage}
        startDate={event.startDate}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {event.descriptionHtml ? (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-gray-900">About This Event</h2>
              <div className="prose mt-3 max-w-none" dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} />
            </section>
          ) : null}

          <EventAgenda items={event.agendaItems} />
          <EventSpeakers speakers={event.speakers} />
          <LocationMap
            locationType={event.locationType}
            venue={event.venue}
            address={event.address}
            city={event.city}
            state={event.state}
            country={event.country}
          />
        </div>

        <aside className="space-y-6">
          <EventInfo
            startDate={event.startDate}
            endDate={event.endDate}
            timezone={event.timezone}
            locationType={event.locationType}
            venue={event.venue}
            address={event.address}
            city={event.city}
            state={event.state}
            country={event.country}
            onlineUrl={event.onlineUrl}
          />

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-gray-900">Tickets</h2>
            <div className="mt-4 space-y-3">
              {event.ticketTypes.length === 0 ? (
                <p className="text-sm text-gray-600">Ticket sales are not open yet.</p>
              ) : (
                event.ticketTypes.map((ticket) => (
                  <div key={ticket.id} className="rounded-md border border-gray-100 p-3">
                    <p className="font-medium text-gray-900">{ticket.name}</p>
                    <p className="text-sm text-gray-600">{ticket.currency} {ticket.price.toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
            <Link href={`/events/${event.slug}/checkout`} className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Purchase Tickets
            </Link>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Share</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(eventUrl)}&text=${encodeURIComponent(event.title)}`} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-3 py-2 text-gray-700">X</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 px-3 py-2 text-gray-700">Facebook</a>
              <a href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(eventUrl)}`} className="rounded-md border border-gray-300 px-3 py-2 text-gray-700">Email</a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
