import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireEventOrganizer } from '@/lib/auth/permissions'
import { createTicketTypeSchema } from '@/lib/validations'
import {
  isDiscountCodeActive,
  mapTicketTypeWithAvailability,
  normalizeDiscountCode,
} from '@/lib/tickets'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: eventId } = await context.params
  const discountCodeParam = request.nextUrl.searchParams.get('discountCode')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      ticketTypes: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let revealedTicketTypeIds = new Set<string>()
  let revealAllHidden = false
  let discountCodeValid = false

  if (discountCodeParam) {
    const discountCode = await prisma.discountCode.findUnique({
      where: {
        eventId_code: {
          eventId,
          code: normalizeDiscountCode(discountCodeParam),
        },
      },
      include: {
        ticketTypes: true,
      },
    })

    if (discountCode && isDiscountCodeActive(discountCode)) {
      discountCodeValid = true
      if (discountCode.ticketTypes.length === 0) {
        revealAllHidden = true
      } else {
        revealedTicketTypeIds = new Set(discountCode.ticketTypes.map((item) => item.ticketTypeId))
      }
    }
  }

  const filteredTicketTypes = event.ticketTypes
    .filter((ticketType) => {
      if (ticketType.isVisible) return true
      if (!discountCodeValid) return false
      if (revealAllHidden) return true
      return revealedTicketTypeIds.has(ticketType.id)
    })
    .map(mapTicketTypeWithAvailability)

  return NextResponse.json({
    ticketTypes: filteredTicketTypes,
    discountCodeValid,
  })
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const body = await request.json()
    const parsed = createTicketTypeSchema.safeParse({
      ...body,
      eventId,
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const input = parsed.data

    const ticketType = await prisma.ticketType.create({
      data: {
        eventId,
        name: input.name,
        description: input.description,
        price: input.price,
        currency: input.currency,
        maxCapacity: input.maxCapacity,
        salesStartDate: input.salesStartDate ? new Date(input.salesStartDate) : null,
        salesEndDate: input.salesEndDate ? new Date(input.salesEndDate) : null,
        isVisible: input.isVisible,
        maxPerOrder: input.maxPerOrder,
        minPerOrder: input.minPerOrder,
        sortOrder: input.sortOrder,
      },
    })

    return NextResponse.json({
      ticketType,
      message: 'Ticket type created successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (error.message === 'Event not found') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
    }

    console.error('Failed to create ticket type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
