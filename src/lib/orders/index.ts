import { Prisma } from '@prisma/client'
import { generateTicketCode } from '@/lib/utils'
import { decimalToNumber, toMoneyCents, fromMoneyCents } from '@/lib/tickets'

export interface RequestedOrderItem {
  ticketTypeId: string
  quantity: number
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
    maxPerOrder: number
  }>,
  requestedItems: RequestedOrderItem[]
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

    if (requestedItem.quantity > ticketType.maxPerOrder) {
      throw new Error(
        `Maximum quantity for ${ticketType.name} is ${ticketType.maxPerOrder}`
      )
    }

    const unitPrice = decimalToNumber(ticketType.price)
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

export function generateTicketCreateInput(orderId: string, items: PreparedOrderItem[]) {
  const tickets: Array<{
    ticketCode: string
    orderId: string
    ticketTypeId: string
  }> = []

  for (const item of items) {
    for (let i = 0; i < item.quantity; i += 1) {
      tickets.push({
        ticketCode: generateTicketCode(),
        orderId,
        ticketTypeId: item.ticketTypeId,
      })
    }
  }

  return tickets
}
