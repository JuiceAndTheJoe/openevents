import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDownloadPresignedUrl } from '@/lib/storage'
import { extractObjectKeyFromStorageRef } from '@/lib/storage/object-key'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const slot = request.nextUrl.searchParams.get('slot') === 'bottom' ? 'bottom' : 'cover'

    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      select: {
        id: true,
        status: true,
        coverImage: true,
        organizer: {
          select: {
            userId: true,
          },
        },
        media: {
          where: {
            type: 'IMAGE',
            title: 'BOTTOM_IMAGE',
          },
          select: {
            url: true,
          },
          take: 1,
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'PUBLISHED') {
      const user = await getCurrentUser()
      const canAccessDraft = user
        ? hasRole(user.roles, ['ORGANIZER', 'SUPER_ADMIN']) &&
          (hasRole(user.roles, 'SUPER_ADMIN') || event.organizer.userId === user.id)
        : false

      if (!canAccessDraft) {
        return NextResponse.json({ error: 'Event image not found' }, { status: 404 })
      }
    }

    const imageUrl = slot === 'cover' ? event.coverImage : event.media[0]?.url

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const key = extractObjectKeyFromStorageRef(imageUrl, ['events', 'speakers', 'users'])
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
    console.error('Get event image failed:', error)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}
