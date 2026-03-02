import { DiscountCode, DiscountCodeTicketType, DiscountType, Prisma, TicketType } from '@prisma/client'
import { getRemainingCapacity, isTicketAvailable } from '@/lib/utils'

export type TicketTypeWithComputedAvailability = TicketType & {
  sold: number
  remaining: number | null
  isAvailable: boolean
}

export type DiscountCodeWithTicketLinks = DiscountCode & {
  ticketTypes: DiscountCodeTicketType[]
}

export interface CalculatedTotals {
  subtotal: number
  discountAmount: number
  totalAmount: number
}

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return value.toNumber()
}

export function toMoneyCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromMoneyCents(amountInCents: number): number {
  return Number((amountInCents / 100).toFixed(2))
}

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase()
}

export function getDiscountCodeConsumedTicketCount(
  discountCode: Pick<DiscountCode, 'redeemedTicketCount'>
): number {
  return discountCode.redeemedTicketCount
}

export function getDiscountCodeRemainingTicketUses(
  discountCode: Pick<DiscountCode, 'maxUses' | 'redeemedTicketCount'>
): number | null {
  if (discountCode.maxUses === null) {
    return null
  }

  return Math.max(0, discountCode.maxUses - getDiscountCodeConsumedTicketCount(discountCode))
}

export function getSelectedTicketQuantity(
  ticketQuantities: Record<string, number | undefined>,
  applicableTicketTypeIds: string[] = []
): number {
  const idsToCount = applicableTicketTypeIds.length > 0
    ? applicableTicketTypeIds
    : Object.keys(ticketQuantities)

  return idsToCount.reduce(
    (sum, id) => sum + Math.max(0, ticketQuantities[id] ?? 0),
    0
  )
}

export function isDiscountCodeActive(discountCode: DiscountCode): boolean {
  const now = new Date()

  if (!discountCode.isActive) return false
  if (discountCode.validFrom && discountCode.validFrom > now) return false
  if (discountCode.validUntil && discountCode.validUntil < now) return false
  if (getDiscountCodeRemainingTicketUses(discountCode) === 0) {
    return false
  }

  return true
}

export function getApplicableTicketTypeIds(discountCode: DiscountCodeWithTicketLinks): string[] {
  return discountCode.ticketTypes.map((link) => link.ticketTypeId)
}

export function discountAppliesToTicketType(
  discountCode: DiscountCodeWithTicketLinks,
  ticketTypeId: string
): boolean {
  const applicableIds = getApplicableTicketTypeIds(discountCode)

  if (applicableIds.length === 0) {
    return true
  }

  return applicableIds.includes(ticketTypeId)
}

export function calculateDiscountAmount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  const subtotalCents = toMoneyCents(subtotal)

  switch (discountType) {
    case 'PERCENTAGE': {
      const discountCents = Math.round((subtotalCents * discountValue) / 100)
      return fromMoneyCents(Math.max(0, Math.min(discountCents, subtotalCents)))
    }
    case 'FIXED_AMOUNT': {
      const fixedCents = toMoneyCents(discountValue)
      return fromMoneyCents(Math.max(0, Math.min(fixedCents, subtotalCents)))
    }
    case 'FREE_TICKET':
      return fromMoneyCents(subtotalCents)
    case 'INVOICE':
      return 0
    default:
      return 0
  }
}

export function calculateOrderTotals(
  subtotal: number,
  discountType?: DiscountType,
  discountValue?: number
): CalculatedTotals {
  const normalizedSubtotal = Number(subtotal.toFixed(2))

  if (!discountType) {
    return {
      subtotal: normalizedSubtotal,
      discountAmount: 0,
      totalAmount: normalizedSubtotal,
    }
  }

  const discountAmount = calculateDiscountAmount(
    normalizedSubtotal,
    discountType,
    discountValue ?? 0
  )

  return {
    subtotal: normalizedSubtotal,
    discountAmount,
    totalAmount: Number(Math.max(0, normalizedSubtotal - discountAmount).toFixed(2)),
  }
}

export function mapTicketTypeWithAvailability(ticketType: TicketType): TicketTypeWithComputedAvailability {
  const sold = ticketType.soldCount
  const remaining = getRemainingCapacity(ticketType.maxCapacity, sold, ticketType.reservedCount)

  return {
    ...ticketType,
    sold,
    remaining,
    isAvailable: isTicketAvailable(
      ticketType.salesStartDate,
      ticketType.salesEndDate,
      ticketType.maxCapacity,
      ticketType.soldCount,
      ticketType.reservedCount
    ),
  }
}
