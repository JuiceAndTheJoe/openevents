import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

type PublishIssue = {
  section: string
  field: string
  message: string
}

function formatPublishError(issues: PublishIssue[]): string {
  const lines = issues.map((issue) => `${issue.section} -> ${issue.field}: ${issue.message}`)
  return `Cannot publish yet. Fix the following:\n- ${lines.join('\n- ')}`
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

    const issues: PublishIssue[] = []

    if (!event.title?.trim()) {
      issues.push({
        section: 'Event Header',
        field: 'Title',
        message: 'Enter an event title.',
      })
    }

    if (!event.description?.trim() && !event.descriptionHtml?.trim()) {
      issues.push({
        section: 'Overview',
        field: 'Description',
        message: 'Add a simple or rich description.',
      })
    }

    if (!event.startDate) {
      issues.push({
        section: 'Event Header',
        field: 'Start',
        message: 'Set a start date and time.',
      })
    }

    if (!event.endDate) {
      issues.push({
        section: 'Event Header',
        field: 'End',
        message: 'Set an end date and time.',
      })
    }

    if (!event.timezone?.trim()) {
      issues.push({
        section: 'Event Header',
        field: 'Timezone',
        message: 'Set the event timezone.',
      })
    }

    if (event.endDate <= event.startDate) {
      issues.push({
        section: 'Event Header',
        field: 'End',
        message: 'End time must be after start time.',
      })
    }

    if (event.locationType === 'PHYSICAL') {
      if (!event.venue?.trim()) {
        issues.push({
          section: 'Location',
          field: 'Venue',
          message: 'Add a venue for a physical event.',
        })
      }
      if (!event.city?.trim()) {
        issues.push({
          section: 'Location',
          field: 'City',
          message: 'Add a city for a physical event.',
        })
      }
      if (!event.country?.trim()) {
        issues.push({
          section: 'Location',
          field: 'Country',
          message: 'Add a country for a physical event.',
        })
      }
    }

    if (event.locationType === 'ONLINE' || event.locationType === 'HYBRID') {
      if (!event.onlineUrl?.trim()) {
        issues.push({
          section: 'Location',
          field: 'Online URL',
          message: 'Add an online URL for online/hybrid events.',
        })
      }
    }

    if (event._count.ticketTypes < 1) {
      issues.push({
        section: 'Tickets',
        field: 'Ticket types',
        message: 'Create at least one ticket type before publishing.',
      })
    }

    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: formatPublishError(issues),
          details: issues,
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
