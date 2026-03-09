import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { ChoosePasswordForm } from '@/components/auth/ChoosePasswordForm'

export const metadata: Metadata = {
  title: 'Choose Password | OpenEvents',
  description: 'Set your new password to continue using OpenEvents',
}

export default async function ChoosePasswordPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.mustChangePassword) {
    if (hasRole(user.roles, ['ORGANIZER', 'SUPER_ADMIN'])) {
      redirect('/dashboard')
    }

    redirect('/events')
  }

  return <ChoosePasswordForm />
}
