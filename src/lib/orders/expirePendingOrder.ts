import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { lockTicketTypes } from '@/lib/orders'
import { getDiscountUsageUnitsFromItems, releaseDiscountCodeUsage } from '@/lib/orders/discountUsage'

/**
 * Expires a pending order reservation if its expiry timestamp has passed.
 * Returns true when the order was transitioned to CANCELLED.
 */
export async function expirePendingOrderIfNeeded(orderId: string): Promise<boolean> {
  const now = new Date()

  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          paidAt: true,
          cancelledAt: true,
          expiresAt: true,
          discountCodeId: true,
          items: {
            select: {
              ticketTypeId: true,
              quantity: true,
            },
          },
        },
      })

      if (!order) {
        return false
      }

      if (
        order.status !== 'PENDING' ||
        order.paidAt !== null ||
        order.cancelledAt !== null ||
        order.expiresAt === null ||
        order.expiresAt > now
      ) {
        return false
      }

      const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))
      await lockTicketTypes(tx, ticketTypeIds)

      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paidAt: null,
          cancelledAt: null,
          expiresAt: {
            lte: now,
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          expiresAt: null,
        },
      })

      if (updated.count === 0) {
        return false
      }

      for (const item of order.items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: {
            reservedCount: {
              decrement: item.quantity,
            },
          },
        })
      }

      if (order.discountCodeId) {
        const usageUnits = getDiscountUsageUnitsFromItems(order.items)
        await releaseDiscountCodeUsage(tx, order.discountCodeId, usageUnits)
      }

      return true
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )
}
