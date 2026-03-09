import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { getDownloadPresignedUrl } from '@/lib/storage'
import { extractObjectKeyFromStorageRef } from '@/lib/storage/object-key'

export async function GET() {
  try {
    const user = await requireRole(['ORGANIZER', 'SUPER_ADMIN'])

    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: user.id },
      select: { logo: true },
    })

    if (!profile?.logo) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 })
    }

    const key = extractObjectKeyFromStorageRef(profile.logo, ['events', 'speakers', 'users', 'organizers'])
    if (!key) {
      return NextResponse.json({ error: 'Invalid logo key' }, { status: 400 })
    }

    const signedUrl = await getDownloadPresignedUrl(key, 900)
    return NextResponse.redirect(signedUrl, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('Get organizer logo failed:', error)
    return NextResponse.json({ error: 'Failed to load logo' }, { status: 500 })
  }
}
