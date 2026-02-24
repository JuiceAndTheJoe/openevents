import Link from 'next/link'
import { EventStatus } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { EventStatusBadge } from '@/components/dashboard/EventStatusBadge'
import { formatDateTime } from '@/lib/utils'

type UpcomingEventsProps = {
  events: Array<{
    id: string
    slug: string
    title: string
    startDate: Date
    status: EventStatus
  }>
}

export async function UpcomingEvents({ events }: UpcomingEventsProps) {
  const t = await getTranslations('dashboard.upcomingEvents')

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
        <Link href="/dashboard/events" className="text-sm text-blue-600 hover:text-blue-700">
          {t('viewAll')}
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-600">{t('noEvents')}</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/dashboard/events/${event.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                  {event.title}
                </Link>
                <EventStatusBadge status={event.status} />
              </div>
              <p className="mt-1 text-sm text-gray-600">{formatDateTime(event.startDate)}</p>
              <Link href={`/events/${event.slug}`} className="mt-1 inline-block text-xs text-gray-500 hover:text-gray-700">
                {t('openPublicPage')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
