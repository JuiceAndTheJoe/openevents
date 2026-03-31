import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireEventOrganizer } from '@/lib/auth/permissions'
import { updateDiscountCodeSchema } from '@/lib/validations'
import { normalizeDiscountCode } from '@/lib/tickets'

interface RouteContext {
  params: Promise<{ id: string; codeId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId, codeId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const existingCode = await prisma.discountCode.findFirst({
      where: {
        id: codeId,
        eventId,
      },
      include: {
        ticketTypes: true,
      },
    })

    if (!existingCode) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateDiscountCodeSchema.safeParse({
      ...body,
      code: body?.code ? normalizeDiscountCode(body.code) : body?.code,
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

    if (input.ticketTypeIds !== undefined && input.ticketTypeIds.length > 0) {
      const validTicketTypes = await prisma.ticketType.findMany({
        where: {
          eventId,
          id: {
            in: input.ticketTypeIds,
          },
        },
        select: {
          id: true,
        },
      })

      if (validTicketTypes.length !== input.ticketTypeIds.length) {
        return NextResponse.json(
          { error: 'One or more ticket types do not belong to this event' },
          { status: 400 }
        )
      }
    }

    if (input.code && input.code !== existingCode.code) {
      const codeInUse = await prisma.discountCode.findUnique({
        where: {
          eventId_code: {
            eventId,
            code: input.code,
          },
        },
        select: { id: true },
      })

      if (codeInUse) {
        return NextResponse.json(
          { error: 'Discount code already exists for this event' },
          { status: 409 }
        )
      }
    }

    const updatedCode = await prisma.$transaction(async (tx) => {
      await tx.discountCode.update({
        where: { id: codeId },
        data: {
          code: input.code,
          discountType: input.discountType,
          discountValue: input.discountValue,
          maxUses: input.maxUses,
          minCartAmount: input.minCartAmount !== undefined ? input.minCartAmount : undefined,
          applyToWholeOrder: input.discountType === 'FREE_TICKET' ? true : input.applyToWholeOrder,
          maxTicketsPerOrder: input.maxTicketsPerOrder !== undefined ? input.maxTicketsPerOrder : undefined,
          validFrom: input.validFrom
            ? new Date(input.validFrom)
            : input.validFrom === null
            ? null
            : undefined,
          validUntil: input.validUntil
            ? new Date(input.validUntil)
            : input.validUntil === null
            ? null
            : undefined,
          isActive: input.isActive,
        },
      })

      if (input.ticketTypeIds !== undefined) {
        await tx.discountCodeTicketType.deleteMany({
          where: { discountCodeId: codeId },
        })

        if (input.ticketTypeIds.length > 0) {
          await tx.discountCodeTicketType.createMany({
            data: input.ticketTypeIds.map((ticketTypeId) => ({
              discountCodeId: codeId,
              ticketTypeId,
            })),
          })
        }
      }

      return tx.discountCode.findUniqueOrThrow({
        where: { id: codeId },
        include: {
          ticketTypes: true,
        },
      })
    })

    return NextResponse.json({
      discountCode: updatedCode,
      message: 'Discount code updated successfully',
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

    console.error('Failed to update discount code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId, codeId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const existingCode = await prisma.discountCode.findFirst({
      where: {
        id: codeId,
        eventId,
      },
      select: {
        id: true,
      },
    })

    if (!existingCode) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
    }

    await prisma.discountCode.delete({
      where: {
        id: codeId,
      },
    })

    return NextResponse.json({ message: 'Discount code deleted successfully' })
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

    console.error('Failed to delete discount code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
