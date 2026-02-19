import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!hasRole(user.roles, 'ORGANIZER')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Organizer role is required to access the dashboard.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Organizer</h2>
        <nav className="mt-3 space-y-1 text-sm">
          <Link href="/dashboard" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50">Overview</Link>
          <Link href="/dashboard/events" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50">Events</Link>
          <Link href="/dashboard/settings" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50">Profile Settings</Link>
          <Link href="/dashboard/settings/account" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-50">Account Settings</Link>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  )
}
