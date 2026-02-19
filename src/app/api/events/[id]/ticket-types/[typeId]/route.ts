import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireEventOrganizer } from '@/lib/auth/permissions'
import { updateTicketTypeSchema } from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string; typeId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId, typeId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const existingType = await prisma.ticketType.findFirst({
      where: {
        id: typeId,
        eventId,
      },
    })

    if (!existingType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateTicketTypeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const data = parsed.data

    if (data.minPerOrder && data.maxPerOrder && data.minPerOrder > data.maxPerOrder) {
      return NextResponse.json(
        { error: 'minPerOrder cannot be greater than maxPerOrder' },
        { status: 400 }
      )
    }

    const updatedType = await prisma.ticketType.update({
      where: { id: typeId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        currency: data.currency,
        maxCapacity: data.maxCapacity,
        salesStartDate: data.salesStartDate
          ? new Date(data.salesStartDate)
          : data.salesStartDate === null
          ? null
          : undefined,
        salesEndDate: data.salesEndDate
          ? new Date(data.salesEndDate)
          : data.salesEndDate === null
          ? null
          : undefined,
        isVisible: data.isVisible,
        maxPerOrder: data.maxPerOrder,
        minPerOrder: data.minPerOrder,
        sortOrder: data.sortOrder,
      },
    })

    return NextResponse.json({
      ticketType: updatedType,
      message: 'Ticket type updated successfully',
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

    console.error('Failed to update ticket type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId, typeId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const existingType = await prisma.ticketType.findFirst({
      where: {
        id: typeId,
        eventId,
      },
      select: {
        id: true,
        soldCount: true,
      },
    })

    if (!existingType) {
      return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 })
    }

    if (existingType.soldCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete ticket type with sold tickets' },
        { status: 409 }
      )
    }

    await prisma.ticketType.delete({
      where: { id: typeId },
    })

    return NextResponse.json({ message: 'Ticket type deleted successfully' })
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

    console.error('Failed to delete ticket type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
