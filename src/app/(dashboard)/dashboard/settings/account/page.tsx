import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { AccountSettings } from '@/components/dashboard/AccountSettings'
import { sendEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'

const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30
const ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX = 'account-delete-confirm:'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
    const dbDeletionUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        deletedAt: true,
      },
    })

    if (!dbDeletionUser) {
      redirect('/login')
    }

    if (dbDeletionUser.deletedAt) {
      revalidatePath('/dashboard/settings/account')
      return
    }

    const verificationToken = generateToken()
    const tokenExpiresAt = new Date(
      Date.now() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    )
    const confirmUrl = `${APP_URL}/api/account/delete/confirm?token=${verificationToken}`

    await prisma.$transaction(async (tx) => {
      await tx.userVerificationToken.deleteMany({
        where: {
          userId: currentUser.id,
          token: {
            startsWith: ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX,
          },
        },
      })

      await tx.userVerificationToken.create({
        data: {
          userId: currentUser.id,
          token: `${ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX}${verificationToken}`,
          expires: tokenExpiresAt,
        },
      })
    })

    await sendEmail({
      to: dbDeletionUser.email,
      subject: 'Confirm your OpenEvents account deletion',
      html: `
        <p>We received a request to delete your OpenEvents account.</p>
        <p>To confirm deletion, use the link below. This confirmation link stays valid for ${ACCOUNT_DELETION_GRACE_PERIOD_DAYS} days.</p>
        <p><a href="${confirmUrl}">${confirmUrl}</a></p>
        <p>If you did not request account deletion, ignore this email and no account changes will be made.</p>
      `,
      text: `We received a request to delete your OpenEvents account. Confirm deletion here: ${confirmUrl}. If you did not request this, ignore this email.`,
    })
    revalidatePath('/dashboard/settings/account')
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
