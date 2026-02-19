import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireEventOrganizer } from '@/lib/auth/permissions'
import { createDiscountCodeSchema } from '@/lib/validations'
import { normalizeDiscountCode } from '@/lib/tickets'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const discountCodes = await prisma.discountCode.findMany({
      where: { eventId },
      include: {
        ticketTypes: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ discountCodes })
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

    console.error('Failed to list discount codes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params
    const user = await requireAuth()

    await requireEventOrganizer(eventId, user.id)

    const body = await request.json()
    const parsed = createDiscountCodeSchema.safeParse({
      ...body,
      eventId,
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

    if (input.ticketTypeIds && input.ticketTypeIds.length > 0) {
      const ticketTypes = await prisma.ticketType.findMany({
        where: {
          eventId,
          id: {
            in: input.ticketTypeIds,
          },
        },
        select: { id: true },
      })

      if (ticketTypes.length !== input.ticketTypeIds.length) {
        return NextResponse.json(
          { error: 'One or more ticket types do not belong to this event' },
          { status: 400 }
        )
      }
    }

    const existingCode = await prisma.discountCode.findUnique({
      where: {
        eventId_code: {
          eventId,
          code: input.code,
        },
      },
      select: { id: true },
    })

    if (existingCode) {
      return NextResponse.json(
        { error: 'Discount code already exists for this event' },
        { status: 409 }
      )
    }

    const discountCode = await prisma.discountCode.create({
      data: {
        eventId,
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxUses: input.maxUses,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        isActive: input.isActive,
        ticketTypes:
          input.ticketTypeIds && input.ticketTypeIds.length > 0
            ? {
                createMany: {
                  data: input.ticketTypeIds.map((ticketTypeId) => ({ ticketTypeId })),
                },
              }
            : undefined,
      },
      include: {
        ticketTypes: true,
      },
    })

    return NextResponse.json({
      discountCode,
      message: 'Discount code created successfully',
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

    console.error('Failed to create discount code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
