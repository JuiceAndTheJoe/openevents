import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { OrganizerProfileForm } from '@/components/dashboard/OrganizerProfileForm'

export default async function OrganizerSettingsPage() {
  const { organizerProfile } = await requireOrganizerProfile()

  async function updateOrganizerProfile(formData: FormData) {
    'use server'

    const { organizerProfile: profile } = await requireOrganizerProfile()

    const orgName = String(formData.get('orgName') || '').trim()
    const description = String(formData.get('description') || '').trim() || null
    const website = String(formData.get('website') || '').trim() || null
    const logo = String(formData.get('logo') || '').trim() || null

    const socialLinks = {
      twitter: String(formData.get('twitter') || '').trim(),
      linkedin: String(formData.get('linkedin') || '').trim(),
    }

    await prisma.organizerProfile.update({
      where: { id: profile.id },
      data: {
        orgName,
        description,
        website,
        logo,
        socialLinks,
      },
    })

    revalidatePath('/dashboard/settings')
  }

  return (
    <OrganizerProfileForm
      initial={{
        orgName: organizerProfile.orgName,
        description: organizerProfile.description,
        logo: organizerProfile.logo,
        website: organizerProfile.website,
        socialLinks: (organizerProfile.socialLinks as Record<string, string> | null) || {},
      }}
      action={updateOrganizerProfile}
    />
  )
}
