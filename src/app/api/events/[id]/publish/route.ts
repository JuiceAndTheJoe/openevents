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

type ActionHint = {
  label: string
  href: string
}

function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      message,
      error: message,
      ...(extra ?? {}),
    },
    { status }
  )
}

function formatPublishError(issues: PublishIssue[]): string {
  const lines = issues.map((issue) => `${issue.section} -> ${issue.field}: ${issue.message}`)
  return `Cannot publish yet. Fix the following:\n- ${lines.join('\n- ')}`
}

function getPublishActionHint(issues: PublishIssue[], eventId: string): ActionHint {
  const hasTicketIssue = issues.some((issue) => issue.section === 'Tickets')
  if (hasTicketIssue) {
    return {
      label: 'Add a ticket type',
      href: `/dashboard/events/${eventId}/tickets`,
    }
  }

  return {
    label: 'Edit event details',
    href: `/dashboard/events/${eventId}/edit`,
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(['ORGANIZER', 'SUPER_ADMIN'])
    const { id } = await context.params

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ticketTypes: true,
          },
        },
      },
    })

    if (!event) return errorResponse('Event not found.', 404)

    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
      return errorResponse('Cancelled or completed events cannot be published.', 400)
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

    if (event.locationType !== 'ONLINE') {
      if (!event.venue?.trim()) {
        issues.push({
          section: 'Location',
          field: 'Venue',
          message: 'Add a venue for a physical or hybrid event.',
        })
      }
      if (!event.address?.trim()) {
        issues.push({
          section: 'Location',
          field: 'Address',
          message: 'Add an address for a physical or hybrid event.',
        })
      }
      if (!event.city?.trim()) {
        issues.push({
          section: 'Location',
          field: 'City',
          message: 'Add a city for a physical or hybrid event.',
        })
      }
      if (!event.country?.trim()) {
        issues.push({
          section: 'Location',
          field: 'Country',
          message: 'Add a country for a physical or hybrid event.',
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
      const action = getPublishActionHint(issues, id)
      return errorResponse(`Cannot publish: ${issues[0].message}`, 400, {
        details: issues,
        action,
        summary: formatPublishError(issues),
      })
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
        return errorResponse('Unauthorized.', 401)
      }

      if (error.message.includes('Forbidden')) {
        return errorResponse(error.message, 403)
      }
    }

    console.error('Publish event failed:', error)
    return errorResponse(
      'Could not publish the event due to a system error. Please try again.',
      500
    )
  }
}
