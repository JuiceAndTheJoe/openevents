import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { AccountSettings } from '@/components/dashboard/AccountSettings'

export default async function AccountSettingsPage() {
  const user = await requireRole('ORGANIZER')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      accounts: {
        select: {
          provider: true,
        },
      },
    },
  })

  if (!dbUser) {
    redirect('/login')
  }

  async function updateEmailAction(formData: FormData) {
    'use server'

    const currentUser = await requireRole('ORGANIZER')
    const email = String(formData.get('email') || '').trim().toLowerCase()

    if (!email) return

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { email },
    })

    revalidatePath('/dashboard/settings/account')
  }

  async function changePasswordAction(formData: FormData) {
    'use server'

    const currentUser = await requireRole('ORGANIZER')
    const currentPassword = String(formData.get('currentPassword') || '')
    const newPassword = String(formData.get('newPassword') || '')

    if (!currentPassword || !newPassword) return

    const currentDbUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        passwordHash: true,
      },
    })

    if (!currentDbUser?.passwordHash) return

    const isValid = await bcrypt.compare(currentPassword, currentDbUser.passwordHash)
    if (!isValid) return

    const newHash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash: newHash },
    })

    revalidatePath('/dashboard/settings/account')
  }

  async function deleteAccountAction(formData: FormData) {
    'use server'
    void formData

    const currentUser = await requireRole('ORGANIZER')
    const now = new Date()
    const anonymizedEmail = `deleted+${currentUser.id}-${now.getTime()}@openevents.invalid`

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: { userId: currentUser.id },
      })

      await tx.account.deleteMany({
        where: { userId: currentUser.id },
      })

      await tx.userVerificationToken.deleteMany({
        where: { userId: currentUser.id },
      })

      await tx.passwordResetToken.deleteMany({
        where: { userId: currentUser.id },
      })

      await tx.userRole.deleteMany({
        where: { userId: currentUser.id },
      })

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          email: anonymizedEmail,
          firstName: null,
          lastName: null,
          passwordHash: null,
          emailVerified: null,
          deletedAt: now,
          anonymizedAt: now,
        },
      })
    })

    const cookieStore = await cookies()
    const sessionCookieNames = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'authjs.session-token',
      '__Secure-authjs.session-token',
    ]

    for (const cookieName of sessionCookieNames) {
      cookieStore.delete(cookieName)
    }

    redirect('/events')
  }

  return (
    <AccountSettings
      userEmail={dbUser.email}
      connectedAccounts={dbUser.accounts.map((account) => account.provider)}
      updateEmailAction={updateEmailAction}
      changePasswordAction={changePasswordAction}
      deleteAccountAction={deleteAccountAction}
    />
  )
}
