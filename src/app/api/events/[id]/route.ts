import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { updateEventSchema } from '@/lib/validations/event'

type RouteContext = {
  params: Promise<{ id: string }>
}

const updateEventApiSchema = updateEventSchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole('ORGANIZER')
    const { id } = await context.params

    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (existingEvent.organizer.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existingEvent.status === 'CANCELLED' || existingEvent.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cancelled or completed events cannot be updated' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateEventApiSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { categoryIds, status, ...input } = parsed.data

    const nextStartDate = input.startDate ? new Date(input.startDate) : existingEvent.startDate
    const nextEndDate = input.endDate ? new Date(input.endDate) : existingEvent.endDate

    if (nextEndDate <= nextStartDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    if (categoryIds && categoryIds.length > 0) {
      const existingCategories = await prisma.category.count({
        where: { id: { in: categoryIds } },
      })

      if (existingCategories !== categoryIds.length) {
        return NextResponse.json(
          { error: 'One or more categoryIds are invalid' },
          { status: 400 }
        )
      }
    }

    const updatedEvent = await prisma.$transaction(async (tx) => {
      const event = await tx.event.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          descriptionHtml: input.descriptionHtml,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          timezone: input.timezone,
          locationType: input.locationType,
          venue: input.venue,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          postalCode: input.postalCode,
          onlineUrl: input.onlineUrl,
          coverImage: input.coverImage,
          visibility: input.visibility,
          cancellationDeadlineHours: input.cancellationDeadlineHours,
          status,
          publishedAt:
            status === 'PUBLISHED'
              ? existingEvent.publishedAt || new Date()
              : status === 'DRAFT'
                ? null
                : undefined,
        },
      })

      if (categoryIds) {
        await tx.eventCategory.deleteMany({ where: { eventId: id } })
        if (categoryIds.length > 0) {
          await tx.eventCategory.createMany({
            data: categoryIds.map((categoryId) => ({ eventId: id, categoryId })),
          })
        }
      }

      return event
    })

    const eventWithRelations = await prisma.event.findUnique({
      where: { id: updatedEvent.id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    })

    return NextResponse.json({ data: eventWithRelations })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Update event failed:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: slug } = await context.params

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: {
          select: {
            id: true,
            orgName: true,
            description: true,
            logo: true,
            website: true,
            socialLinks: true,
          },
        },
        agendaItems: {
          orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
          include: {
            speaker: true,
          },
        },
        speakers: {
          orderBy: { sortOrder: 'asc' },
        },
        ticketTypes: {
          where: { isVisible: true },
          orderBy: { sortOrder: 'asc' },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Private events are accessible via direct slug links.
    return NextResponse.json({ data: event })
  } catch (error) {
    console.error('Get event details failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event details' },
      { status: 500 }
    )
  }
}
