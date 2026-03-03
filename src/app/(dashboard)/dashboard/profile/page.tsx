import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { EventStatusBadge } from '@/components/dashboard/EventStatusBadge'
import { formatDateTime } from '@/lib/utils'

function locationLabel(event: { venue: string | null; city: string | null; country: string | null }, fallback: string) {
  const parts = [event.venue, event.city, event.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : fallback
}

export default async function OrganizerProfilePage() {
  const { user, organizerProfile, isSuperAdmin } = await requireOrganizerProfile()

  // Super admins without organizer profiles should use the admin panel
  if (!organizerProfile) {
    redirect('/admin')
  }

  const now = new Date()

  // For super admins, show platform-wide stats; for organizers, show their own
  const eventWhere: Prisma.EventWhereInput = isSuperAdmin
    ? { deletedAt: null }
    : { organizerId: organizerProfile.id, deletedAt: null }

  const [totalEvents, publishedEvents, draftEvents, upcomingEvents, recentEvents] = await prisma.$transaction([
    prisma.event.count({
      where: eventWhere,
    }),
    prisma.event.count({
      where: {
        ...eventWhere,
        status: 'PUBLISHED',
      },
    }),
    prisma.event.count({
      where: {
        ...eventWhere,
        status: 'DRAFT',
      },
    }),
    prisma.event.count({
      where: {
        ...eventWhere,
        status: 'PUBLISHED',
        startDate: { gte: now },
      },
    }),
    prisma.event.findMany({
      where: eventWhere,
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        venue: true,
        city: true,
        country: true,
      },
      orderBy: { startDate: 'desc' },
      take: 8,
    }),
  ])

  const socialLinks = (organizerProfile.socialLinks as Record<string, string> | null) || {}

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{organizerProfile.orgName}</h1>
            <p className="mt-1 text-sm text-gray-600">Organizer profile</p>
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit Profile
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <p className="font-medium text-gray-900">Contact Email</p>
            <p className="mt-1">{user.email}</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Website</p>
            <p className="mt-1">
              {organizerProfile.website ? (
                <a
                  href={organizerProfile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#5C8BD9] hover:underline"
                >
                  {organizerProfile.website}
                </a>
              ) : (
                'Not set'
              )}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="font-medium text-gray-900">About</p>
            <p className="mt-1 whitespace-pre-wrap">{organizerProfile.description || 'No description yet.'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">LinkedIn</p>
            <p className="mt-1">{socialLinks.linkedin || 'Not set'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Twitter</p>
            <p className="mt-1">{socialLinks.twitter || 'Not set'}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Events</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalEvents}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Published</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{publishedEvents}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Drafts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{draftEvents}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Upcoming</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{upcomingEvents}</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
          <Link href="/dashboard/events" className="text-sm font-medium text-[#5C8BD9] hover:text-[#4a7ac8]">
            Manage Events
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-600">No events yet.</p>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{formatDateTime(event.startDate)}</p>
                    <p className="mt-1 text-sm text-gray-600">{locationLabel(event, 'Location TBD')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EventStatusBadge status={event.status} />
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
