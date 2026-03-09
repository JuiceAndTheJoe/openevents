import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getDownloadPresignedUrl } from '@/lib/storage'
import { extractObjectKeyFromStorageRef } from '@/lib/storage/object-key'

export async function GET() {
  try {
    const user = await requireAuth()
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    })

    if (!dbUser?.image) {
      return NextResponse.json({ error: 'No profile image' }, { status: 404 })
    }

    const key = extractObjectKeyFromStorageRef(dbUser.image, ['users'])
    if (!key) {
      return NextResponse.json({ error: 'Invalid image key' }, { status: 400 })
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

    console.error('Get avatar failed:', error)
    return NextResponse.json({ error: 'Failed to load avatar' }, { status: 500 })
  }
}
