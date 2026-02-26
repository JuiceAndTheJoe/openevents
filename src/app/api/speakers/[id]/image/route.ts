import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDownloadPresignedUrl } from '@/lib/storage'

type RouteContext = {
  params: Promise<{ id: string }>
}

function extractObjectKeyFromUrl(image: string): string | null {
  if (!image) return null

  if (!image.startsWith('http://') && !image.startsWith('https://')) {
    return image.replace(/^\/+/, '')
  }

  try {
    const parsed = new URL(image)
    const bucket = process.env.S3_BUCKET_NAME || 'openevents-media'
    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')

    if (path.startsWith(`${bucket}/`)) {
      return path.slice(bucket.length + 1)
    }

    if (path.startsWith('speakers/') || path.startsWith('users/')) {
      return path
    }

    if (parsed.host.startsWith(`${bucket}.`)) {
      return path
    }

    return null
  } catch {
    return null
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const speaker = await prisma.speaker.findUnique({
      where: { id },
      select: {
        photo: true,
        event: {
          select: {
            status: true,
            deletedAt: true,
            organizer: {
              select: { userId: true },
            },
          },
        },
      },
    })

    if (!speaker || !speaker.photo || speaker.event.deletedAt) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    if (speaker.event.status !== 'PUBLISHED') {
      const user = await getCurrentUser()
      const canAccessDraft = user
        ? hasRole(user.roles, ['ORGANIZER', 'SUPER_ADMIN']) &&
          (hasRole(user.roles, 'SUPER_ADMIN') || speaker.event.organizer.userId === user.id)
        : false

      if (!canAccessDraft) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 })
      }
    }

    const key = extractObjectKeyFromUrl(speaker.photo)
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
    console.error('Get speaker image failed:', error)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}
