import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { OrganizerSidebarNav } from '@/components/dashboard/OrganizerSidebarNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('dashboard.layout')
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!hasRole(user.roles, 'ORGANIZER')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {t('roleRequired')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('organizerHeading')}</h2>
        <OrganizerSidebarNav />
      </aside>
      <div>{children}</div>
    </div>
  )
}
