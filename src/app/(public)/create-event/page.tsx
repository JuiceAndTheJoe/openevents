import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { CreateEventForm } from '@/components/events/CreateEventForm'

export const dynamic = 'force-dynamic'

export default async function CreateEventPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!hasRole(user.roles, 'ORGANIZER')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-semibold text-amber-900">Organizer access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            Your account needs organizer permissions to create and publish events.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return (
    <div className="bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <CreateEventForm categories={categories} />
    </div>
  )
}
