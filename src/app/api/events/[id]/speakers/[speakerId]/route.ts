import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

const updateSpeakerSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  photo: z.string().url().nullable().optional(),
  email: z.string().email().nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  sortOrder: z.number().int().optional(),
})

type RouteContext = {
  params: Promise<{ id: string; speakerId: string }>
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })

  if (!event) {
    return { ok: false as const, status: 404, error: 'Event not found' }
  }

  return { ok: true as const }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(['ORGANIZER', 'SUPER_ADMIN'])
    const { id: eventId, speakerId } = await context.params

    const ownership = await assertEventExists(eventId)
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status })
    }

    const existingSpeaker = await prisma.speaker.findFirst({
      where: { id: speakerId, eventId },
    })

    if (!existingSpeaker) {
      return NextResponse.json({ error: 'Speaker not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSpeakerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const updated = await prisma.speaker.update({
      where: { id: speakerId },
      data: parsed.data,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Update speaker failed:', error)
    return NextResponse.json(
      { error: 'Failed to update speaker' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(['ORGANIZER', 'SUPER_ADMIN'])
    const { id: eventId, speakerId } = await context.params

    const ownership = await assertEventExists(eventId)
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status })
    }

    const existingSpeaker = await prisma.speaker.findFirst({
      where: { id: speakerId, eventId },
      select: { id: true },
    })

    if (!existingSpeaker) {
      return NextResponse.json({ error: 'Speaker not found' }, { status: 404 })
    }

    await prisma.speaker.delete({ where: { id: speakerId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Delete speaker failed:', error)
    return NextResponse.json(
      { error: 'Failed to delete speaker' },
      { status: 500 }
    )
  }
}
