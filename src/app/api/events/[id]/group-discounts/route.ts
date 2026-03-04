import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireEventOrganizer } from '@/lib/auth/permissions'
import { groupDiscountSchema } from '@/lib/validations/event'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        groupDiscounts: {
          orderBy: [{ minQuantity: 'asc' }, { createdAt: 'asc' }],
          include: {
            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({
      groupDiscounts: event.groupDiscounts.map((discount) => ({
        id: discount.id,
        ticketTypeId: discount.ticketTypeId,
        ticketTypeName: discount.ticketType?.name || 'All Ticket Types',
        minQuantity: discount.minQuantity,
        discountType: discount.discountType,
        discountValue: Number(discount.discountValue),
        isActive: discount.isActive,
        createdAt: discount.createdAt,
        updatedAt: discount.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch group discounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const body = await request.json()
    const parsed = groupDiscountSchema.safeParse(body)

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

    // If ticketTypeId is provided, verify it belongs to this event
    if (input.ticketTypeId) {
      const ticketType = await prisma.ticketType.findFirst({
        where: {
          id: input.ticketTypeId,
          eventId,
        },
      })

      if (!ticketType) {
        return NextResponse.json(
          { error: 'Ticket type not found for this event' },
          { status: 404 }
        )
      }
    }

    const groupDiscount = await prisma.groupDiscount.create({
      data: {
        eventId,
        ticketTypeId: input.ticketTypeId || null,
        minQuantity: input.minQuantity,
        discountType: input.discountType,
        discountValue: input.discountValue,
        isActive: input.isActive,
      },
      include: {
        ticketType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      groupDiscount: {
        id: groupDiscount.id,
        ticketTypeId: groupDiscount.ticketTypeId,
        ticketTypeName: groupDiscount.ticketType?.name || 'All Ticket Types',
        minQuantity: groupDiscount.minQuantity,
        discountType: groupDiscount.discountType,
        discountValue: Number(groupDiscount.discountValue),
        isActive: groupDiscount.isActive,
        createdAt: groupDiscount.createdAt,
        updatedAt: groupDiscount.updatedAt,
      },
      message: 'Group discount created successfully',
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

    console.error('Failed to create group discount:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
