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
      },
    })
    return true
  }

  const claimed = await tx.discountCode.updateMany({
    where: {
      id: discountCodeId,
      usedCount: {
        lte: maxUses - usageUnits,
      },
    },
    data: {
      usedCount: {
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

  const released = await tx.discountCode.updateMany({
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

  if (released.count > 0) {
    return usageUnits
  }

  const clamped = await tx.discountCode.updateMany({
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

  return clamped.count > 0 ? usageUnits : 0
}
