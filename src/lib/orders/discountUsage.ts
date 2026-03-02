import { Prisma } from '@prisma/client'

export type QuantityLike = {
  quantity: number
}

export function getDiscountUsageUnitsFromItems(items: QuantityLike[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)
}

export async function claimDiscountCodeUsage(
  tx: Prisma.TransactionClient,
  discountCodeId: string,
  usageUnits: number,
  maxUses: number | null
): Promise<boolean> {
  if (usageUnits <= 0) return true

  if (maxUses === null) {
    await tx.discountCode.update({
      where: { id: discountCodeId },
      data: {
        usedCount: {
          increment: usageUnits,
        },
        redeemedTicketCount: {
          increment: usageUnits,
        },
      },
    })
    return true
  }

  const claimed = await tx.discountCode.updateMany({
    where: {
      id: discountCodeId,
      redeemedTicketCount: {
        lte: maxUses - usageUnits,
      },
    },
    data: {
      usedCount: {
        increment: usageUnits,
      },
      redeemedTicketCount: {
        increment: usageUnits,
      },
    },
  })

  return claimed.count > 0
}

export async function releaseDiscountCodeUsage(
  tx: Prisma.TransactionClient,
  discountCodeId: string,
  usageUnits: number
): Promise<number> {
  if (usageUnits <= 0) return 0

  const releasedUsedCount = await tx.discountCode.updateMany({
    where: {
      id: discountCodeId,
      usedCount: {
        gte: usageUnits,
      },
    },
    data: {
      usedCount: {
        decrement: usageUnits,
      },
    },
  })

  const clampedUsedCount = releasedUsedCount.count === 0
    ? await tx.discountCode.updateMany({
        where: {
          id: discountCodeId,
          usedCount: {
            gt: 0,
          },
        },
        data: {
          usedCount: 0,
        },
      })
    : { count: 0 }

  const releasedRedeemedTicketCount = await tx.discountCode.updateMany({
    where: {
      id: discountCodeId,
      redeemedTicketCount: {
        gte: usageUnits,
      },
    },
    data: {
      redeemedTicketCount: {
        decrement: usageUnits,
      },
    },
  })

  const clampedRedeemedTicketCount = releasedRedeemedTicketCount.count === 0
    ? await tx.discountCode.updateMany({
        where: {
          id: discountCodeId,
          redeemedTicketCount: {
            gt: 0,
          },
        },
        data: {
          redeemedTicketCount: 0,
        },
      })
    : { count: 0 }

  if (
    releasedUsedCount.count === 0 &&
    clampedUsedCount.count === 0 &&
    releasedRedeemedTicketCount.count === 0 &&
    clampedRedeemedTicketCount.count === 0
  ) {
    return 0
  }

  return usageUnits
}
