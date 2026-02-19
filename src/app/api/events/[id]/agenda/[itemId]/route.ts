import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

const updateAgendaItemSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().nullable().optional(),
  speakerId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).refine((data) => {
  if (data.startTime && data.endTime) {
    return new Date(data.endTime) > new Date(data.startTime)
  }
  return true
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
})

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>
}

async function assertOrganizerOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      organizer: {
        select: {
          userId: true,
        },
      },
    },
  })

  if (!event) {
    return { ok: false as const, status: 404, error: 'Event not found' }
  }

  if (event.organizer.userId !== userId) {
    return { ok: false as const, status: 403, error: 'Forbidden' }
  }

  return { ok: true as const }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole('ORGANIZER')
    const { id: eventId, itemId } = await context.params

    const ownership = await assertOrganizerOwnsEvent(eventId, user.id)
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status })
    }

    const existingItem = await prisma.agendaItem.findFirst({
      where: { id: itemId, eventId },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Agenda item not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateAgendaItemSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    if (parsed.data.speakerId) {
      const speaker = await prisma.speaker.findFirst({
        where: {
          id: parsed.data.speakerId,
          eventId,
        },
      })

      if (!speaker) {
        return NextResponse.json(
          { error: 'Speaker must belong to this event' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.agendaItem.update({
      where: { id: itemId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : undefined,
        endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : parsed.data.endTime,
        speakerId: parsed.data.speakerId,
        sortOrder: parsed.data.sortOrder,
      },
      include: {
        speaker: true,
      },
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

    console.error('Update agenda item failed:', error)
    return NextResponse.json(
      { error: 'Failed to update agenda item' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole('ORGANIZER')
    const { id: eventId, itemId } = await context.params

    const ownership = await assertOrganizerOwnsEvent(eventId, user.id)
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status })
    }

    const existingItem = await prisma.agendaItem.findFirst({
      where: { id: itemId, eventId },
      select: { id: true },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Agenda item not found' }, { status: 404 })
    }

    await prisma.agendaItem.delete({ where: { id: itemId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Delete agenda item failed:', error)
    return NextResponse.json(
      { error: 'Failed to delete agenda item' },
      { status: 500 }
    )
  }
}
