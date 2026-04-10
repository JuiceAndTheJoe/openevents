import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { OrganizerProfileForm } from '@/components/dashboard/OrganizerProfileForm'

export const dynamic = 'force-dynamic'

export default async function OrganizerSettingsPage() {
  const { user, organizerProfile } = await requireOrganizerProfile()

  async function updateOrganizerProfile(formData: FormData) {
    'use server'

    const { user: currentUser, organizerProfile: profile } = await requireOrganizerProfile()

    const orgName = String(formData.get('orgName') || '').trim()
    const fallbackOrgName = currentUser.name?.trim() || currentUser.email.split('@')[0] || 'Organization'
    const normalizedOrgName = orgName || fallbackOrgName
    const description = String(formData.get('description') || '').trim() || null
    const website = String(formData.get('website') || '').trim() || null
    const logo = String(formData.get('logo') || '').trim() || null

    const existingSocialLinks = (profile?.socialLinks as Record<string, string> | null) || {}
    const socialLinks = {
      ...existingSocialLinks,
      linkedin: String(formData.get('linkedin') || '').trim(),
    }

    await prisma.organizerProfile.upsert({
      where: { userId: currentUser.id },
      update: {
        orgName: normalizedOrgName,
        description,
        website,
        logo,
        socialLinks,
      },
      create: {
        userId: currentUser.id,
        orgName: normalizedOrgName,
        description,
        website,
        logo,
        socialLinks,
      },
    })

    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/profile')
  }

  return (
    <OrganizerProfileForm
      initial={{
        userId: user.id,
        orgName: organizerProfile?.orgName || user.name || user.email.split('@')[0] || '',
        description: organizerProfile?.description || '',
        logo: organizerProfile?.logo || null,
        website: organizerProfile?.website || '',
        socialLinks: (organizerProfile?.socialLinks as Record<string, string> | null) || {},
      }}
      action={updateOrganizerProfile}
    />
  )
}
