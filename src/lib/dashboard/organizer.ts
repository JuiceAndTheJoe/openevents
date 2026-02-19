import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export async function requireOrganizerProfile() {
  const user = await requireRole('ORGANIZER')

  const organizerProfile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      orgName: true,
      description: true,
      logo: true,
      website: true,
      socialLinks: true,
    },
  })

  if (!organizerProfile) {
    throw new Error('Forbidden: Organizer profile not found')
  }

  return { user, organizerProfile }
}
