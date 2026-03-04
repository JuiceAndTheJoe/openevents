import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireEventOrganizer } from '@/lib/auth/permissions'
import { groupDiscountSchema } from '@/lib/validations/event'

interface RouteContext {
  params: Promise<{ id: string; discountId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId, discountId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const body = await request.json()
    const parsed = groupDiscountSchema.partial().safeParse(body)

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

    // Verify the discount exists and belongs to this event
    const existingDiscount = await prisma.groupDiscount.findFirst({
      where: {
        id: discountId,
        eventId,
      },
    })

    if (!existingDiscount) {
      return NextResponse.json({ error: 'Group discount not found' }, { status: 404 })
    }

    // If ticketTypeId is being updated, verify it belongs to this event
    if (input.ticketTypeId !== undefined && input.ticketTypeId !== null) {
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

    const updateData: {
      ticketTypeId?: string | null
      minQuantity?: number
      discountType?: string
      discountValue?: number
      isActive?: boolean
    } = {}

    if (input.ticketTypeId !== undefined) {
      updateData.ticketTypeId = input.ticketTypeId || null
    }
    if (input.minQuantity !== undefined) {
      updateData.minQuantity = input.minQuantity
    }
    if (input.discountType !== undefined) {
      updateData.discountType = input.discountType
    }
    if (input.discountValue !== undefined) {
      updateData.discountValue = input.discountValue
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive
    }

    const groupDiscount = await prisma.groupDiscount.update({
      where: { id: discountId },
      data: updateData,
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
      message: 'Group discount updated successfully',
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

    console.error('Failed to update group discount:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId, discountId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    // Verify the discount exists and belongs to this event
    const existingDiscount = await prisma.groupDiscount.findFirst({
      where: {
        id: discountId,
        eventId,
      },
    })

    if (!existingDiscount) {
      return NextResponse.json({ error: 'Group discount not found' }, { status: 404 })
    }

    await prisma.groupDiscount.delete({
      where: { id: discountId },
    })

    return NextResponse.json({
      message: 'Group discount deleted successfully',
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

    console.error('Failed to delete group discount:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
