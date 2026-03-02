import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { validateDiscountCodeSchema } from '@/lib/validations'
import {
  decimalToNumber,
  getApplicableTicketTypeIds,
  getDiscountCodeRemainingTicketUses,
  getSelectedTicketQuantity,
  isDiscountCodeActive,
  normalizeDiscountCode,
} from '@/lib/tickets'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      return NextResponse.json({ valid: false })
    }

    if (!isDiscountCodeActive(discountCode)) {
      return NextResponse.json({ valid: false })
    }

    const applicableTicketTypeIds = getApplicableTicketTypeIds(discountCode)
    const inputTicketTypeIds = input.ticketTypeIds ?? []

    if (inputTicketTypeIds.length > 0 && applicableTicketTypeIds.length > 0) {
      const hasOverlap = inputTicketTypeIds.some((id) => applicableTicketTypeIds.includes(id))
      if (!hasOverlap) {
        return NextResponse.json({ valid: false })
      }
    }

    if (discountCode.minCartAmount !== null && input.ticketQuantities !== undefined) {
      const minQuantity = decimalToNumber(discountCode.minCartAmount)
      const totalQuantity = getSelectedTicketQuantity(
        input.ticketQuantities,
        applicableTicketTypeIds
      )
      if (totalQuantity < minQuantity) {
        return NextResponse.json({
          valid: false,
          reason: `At least ${minQuantity} ticket(s) of the applicable type are required for this code`,
        })
      }
    }

    if (discountCode.maxUses !== null && input.ticketQuantities !== undefined) {
      const requestedTicketUses = getSelectedTicketQuantity(
        input.ticketQuantities,
        applicableTicketTypeIds
      )
      const remainingUses = getDiscountCodeRemainingTicketUses(discountCode) ?? 0

      if (requestedTicketUses > remainingUses) {
        return NextResponse.json({
          valid: false,
          reason: 'Discount code has no remaining uses for this quantity of tickets.',
        })
      }
    }

    return NextResponse.json({
      valid: true,
      discount: {
        id: discountCode.id,
        code: discountCode.code,
        discountType: discountCode.discountType,
        discountValue: decimalToNumber(discountCode.discountValue),
        applicableTicketTypeIds: applicableTicketTypeIds,
      },
    })
  } catch (error) {
    console.error('Failed to validate discount code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
