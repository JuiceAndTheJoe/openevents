import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole('ORGANIZER')
    const { id } = await context.params

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            ticketTypes: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.organizer.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cancelled or completed events cannot be published' },
        { status: 400 }
      )
    }

    const missingFields: string[] = []

    if (!event.title?.trim()) missingFields.push('title')
    if (!event.description?.trim()) missingFields.push('description')
    if (!event.startDate) missingFields.push('startDate')
    if (!event.endDate) missingFields.push('endDate')
    if (!event.timezone?.trim()) missingFields.push('timezone')

    if (event.endDate <= event.startDate) missingFields.push('endDate_after_startDate')

    if (event.locationType === 'PHYSICAL') {
      if (!event.venue?.trim()) missingFields.push('venue')
      if (!event.city?.trim()) missingFields.push('city')
      if (!event.country?.trim()) missingFields.push('country')
    }

    if (event.locationType === 'ONLINE' || event.locationType === 'HYBRID') {
      if (!event.onlineUrl?.trim()) missingFields.push('onlineUrl')
    }

    if (event._count.ticketTypes < 1) {
      missingFields.push('ticketTypes')
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Event is missing required fields for publishing',
          missingFields,
        },
        { status: 400 }
      )
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
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

    console.error('Publish event failed:', error)
    return NextResponse.json(
      { error: 'Failed to publish event' },
      { status: 500 }
    )
  }
}
