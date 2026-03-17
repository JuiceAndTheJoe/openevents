import { redirect } from 'next/navigation'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { OrganizerSidebarNav } from '@/components/dashboard/OrganizerSidebarNav'
import { WorkspaceAccessDenied, WorkspaceLayoutContainer } from '@/components/layout/WorkspaceShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.mustChangePassword) {
    redirect('/choose-password?callbackUrl=/dashboard')
  }

  if (!hasRole(user.roles, ['ORGANIZER', 'SUPER_ADMIN'])) {
    return <WorkspaceAccessDenied message="Organizer role is required to access the dashboard." />
  }

  const isSuperAdmin = hasRole(user.roles, ['SUPER_ADMIN'])
  const sidebarTitle = isSuperAdmin ? 'Admin' : 'Organizer'

  return (
    <WorkspaceLayoutContainer sidebarTitle={sidebarTitle} sidebarNav={<OrganizerSidebarNav />}>
      {children}
    </WorkspaceLayoutContainer>
  )
}
