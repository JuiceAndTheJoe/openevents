import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { speakerSchema } from '@/lib/validations/event'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(['ORGANIZER', 'SUPER_ADMIN'])
    const { id: eventId } = await context.params

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = speakerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const speaker = await prisma.speaker.create({
      data: {
        eventId,
        name: parsed.data.name,
        title: parsed.data.title,
        bio: parsed.data.bio,
        photo: parsed.data.photo,
        email: parsed.data.email,
        socialLinks: parsed.data.socialLinks,
        sortOrder: parsed.data.sortOrder,
      },
    })

    return NextResponse.json({ data: speaker }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Create speaker failed:', error)
    return NextResponse.json(
      { error: 'Failed to create speaker' },
      { status: 500 }
    )
  }
}
