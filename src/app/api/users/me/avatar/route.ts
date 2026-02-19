import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getDownloadPresignedUrl } from '@/lib/storage'

function extractObjectKeyFromImageUrl(image: string): string | null {
  if (!image) return null

  // If key is stored directly (e.g. users/abc/file.jpg)
  if (!image.startsWith('http://') && !image.startsWith('https://')) {
    return image
  }

  try {
    const parsed = new URL(image)
    const bucket = process.env.S3_BUCKET_NAME || 'openevents-media'
    const prefix = `/${bucket}/`

    if (!parsed.pathname.startsWith(prefix)) {
      return null
    }

    return decodeURIComponent(parsed.pathname.slice(prefix.length))
  } catch {
    return null
  }
}

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

    const key = extractObjectKeyFromImageUrl(dbUser.image)
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
