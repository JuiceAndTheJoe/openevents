import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getAllLegalContent } from '@/lib/legal-content'
import { LegalContactForm } from '@/components/admin/LegalContactForm'
import { WorkspacePageHeader } from '@/components/layout/WorkspaceShell'

export default async function DashboardAdminLegalPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.roles?.includes('SUPER_ADMIN')) {
    redirect('/dashboard')
  }

  const legalContent = await getAllLegalContent()

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        title="Legal & Contact"
        description="Customize the Terms of Service, About Us, Privacy Policy, and Contact pages."
      />

      <LegalContactForm initialData={legalContent} />
    </div>
  )
}
