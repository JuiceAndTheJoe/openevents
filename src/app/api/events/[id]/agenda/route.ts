import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { agendaItemSchema } from '@/lib/validations/event'

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
    const parsed = agendaItemSchema.safeParse(body)

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

    const item = await prisma.agendaItem.create({
      data: {
        eventId,
        title: parsed.data.title,
        description: parsed.data.description,
        startTime: new Date(parsed.data.startTime),
        endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : null,
        speakerId: parsed.data.speakerId,
        sortOrder: parsed.data.sortOrder,
      },
      include: {
        speaker: true,
      },
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Create agenda item failed:', error)
    return NextResponse.json(
      { error: 'Failed to create agenda item' },
      { status: 500 }
    )
  }
}
