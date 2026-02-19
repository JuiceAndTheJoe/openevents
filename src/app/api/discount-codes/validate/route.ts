import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateDiscountCodeSchema } from '@/lib/validations'
import {
  decimalToNumber,
  getApplicableTicketTypeIds,
  isDiscountCodeActive,
  normalizeDiscountCode,
} from '@/lib/tickets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validateDiscountCodeSchema.safeParse({
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

    const discountCode = await prisma.discountCode.findUnique({
      where: {
        eventId_code: {
          eventId: input.eventId,
          code: input.code,
        },
      },
      include: {
        ticketTypes: true,
      },
    })

    if (!discountCode) {
      return NextResponse.json({ valid: false, reason: 'Discount code not found' }, { status: 404 })
    }

    if (!isDiscountCodeActive(discountCode)) {
      return NextResponse.json(
        { valid: false, reason: 'Discount code is inactive, expired, or fully used' },
        { status: 400 }
      )
    }

    const applicableTicketTypeIds = getApplicableTicketTypeIds(discountCode)
    const inputTicketTypeIds = input.ticketTypeIds ?? []

    if (inputTicketTypeIds.length > 0 && applicableTicketTypeIds.length > 0) {
      const hasOverlap = inputTicketTypeIds.some((id) => applicableTicketTypeIds.includes(id))
      if (!hasOverlap) {
        return NextResponse.json(
          {
            valid: false,
            reason: 'Discount code does not apply to selected ticket types',
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      valid: true,
      discount: {
        id: discountCode.id,
        code: discountCode.code,
        discountType: discountCode.discountType,
        discountValue: decimalToNumber(discountCode.discountValue),
        maxUses: discountCode.maxUses,
        usedCount: discountCode.usedCount,
        applicableTicketTypeIds,
      },
    })
  } catch (error) {
    console.error('Failed to validate discount code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
