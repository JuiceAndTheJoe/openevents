import { Prisma } from '@prisma/client'
import { generateTicketCode } from '@/lib/utils'
import { decimalToNumber, toMoneyCents, fromMoneyCents } from '@/lib/tickets'
import { getPriceIncludingVat } from '@/lib/pricing/vat'

export interface AttendeeData {
  firstName: string
  lastName: string
  email: string
  title?: string
  organization?: string
}

export interface RequestedOrderItem {
  ticketTypeId: string
  quantity: number
  attendees?: AttendeeData[]
}

export interface PreparedOrderItem {
  ticketTypeId: string
  ticketTypeName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  currency: string
}

export async function lockTicketTypes(
  tx: Prisma.TransactionClient,
  ticketTypeIds: string[]
): Promise<void> {
  if (ticketTypeIds.length === 0) return

  const uniqueIds = Array.from(new Set(ticketTypeIds)).sort()

  await tx.$queryRaw`
    SELECT id
    FROM ticket_types
    WHERE id = ANY(${uniqueIds})
    FOR UPDATE
  `
}

export function prepareOrderItems(
  ticketTypes: Array<{
    id: string
    name: string
    price: Prisma.Decimal
    currency: string
    minPerOrder: number
    maxPerOrder: number | null
  }>,
  requestedItems: RequestedOrderItem[],
  options?: {
    vatRate?: number
  }
): { items: PreparedOrderItem[]; subtotal: number } {
  const ticketTypeMap = new Map(ticketTypes.map((ticketType) => [ticketType.id, ticketType]))

  const prepared: PreparedOrderItem[] = []
  let subtotalCents = 0

  for (const requestedItem of requestedItems) {
    const ticketType = ticketTypeMap.get(requestedItem.ticketTypeId)
    if (!ticketType) {
      throw new Error(`Ticket type ${requestedItem.ticketTypeId} not found`) // validated at route-level too
    }

    if (requestedItem.quantity < ticketType.minPerOrder) {
      throw new Error(
        `Minimum quantity for ${ticketType.name} is ${ticketType.minPerOrder}`
      )
    }

    if (ticketType.maxPerOrder !== null && requestedItem.quantity > ticketType.maxPerOrder) {
      throw new Error(
        `Maximum quantity for ${ticketType.name} is ${ticketType.maxPerOrder}`
      )
    }

    const baseUnitPrice = decimalToNumber(ticketType.price)
    const vatRate = options?.vatRate ?? 0
    const unitPrice = vatRate > 0 ? getPriceIncludingVat(baseUnitPrice, vatRate) : baseUnitPrice
    const unitPriceCents = toMoneyCents(unitPrice)
    const totalPriceCents = unitPriceCents * requestedItem.quantity
    subtotalCents += totalPriceCents

    prepared.push({
      ticketTypeId: ticketType.id,
      ticketTypeName: ticketType.name,
      quantity: requestedItem.quantity,
      unitPrice: fromMoneyCents(unitPriceCents),
      totalPrice: fromMoneyCents(totalPriceCents),
      currency: ticketType.currency,
    })
  }

  return {
    items: prepared,
    subtotal: fromMoneyCents(subtotalCents),
  }
}

export interface PreparedOrderItemWithAttendees extends PreparedOrderItem {
  attendees?: AttendeeData[]
}

export function generateTicketCreateInput(orderId: string, items: PreparedOrderItemWithAttendees[]) {
  const tickets: Array<{
    ticketCode: string
    orderId: string
    ticketTypeId: string
    attendeeFirstName?: string
    attendeeLastName?: string
    attendeeEmail?: string
    attendeeTitle?: string
    attendeeOrganization?: string
  }> = []

  for (const item of items) {
    for (let i = 0; i < item.quantity; i += 1) {
      const attendee = item.attendees?.[i]
      tickets.push({
        ticketCode: generateTicketCode(),
        orderId,
        ticketTypeId: item.ticketTypeId,
        attendeeFirstName: attendee?.firstName,
        attendeeLastName: attendee?.lastName,
        attendeeEmail: attendee?.email,
        attendeeTitle: attendee?.title,
        attendeeOrganization: attendee?.organization,
      })
    }
  }

  return tickets
}
