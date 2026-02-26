import { describe, it, expect } from 'vitest'
import {
  claimDiscountCodeUsage,
  getDiscountUsageUnitsFromItems,
  releaseDiscountCodeUsage,
} from '@/lib/orders/discountUsage'

function createFakeTx(initialUsedCount: number) {
  let usedCount = initialUsedCount

  const tx = {
    discountCode: {
      update: async ({ data }: { data: { usedCount?: { increment?: number } } }) => {
        if (data.usedCount?.increment) {
          usedCount += data.usedCount.increment
        }
        return { id: 'dc-1', usedCount }
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string
          usedCount?: { lte?: number; gte?: number; gt?: number }
        }
        data: { usedCount?: { increment?: number; decrement?: number } | number }
      }) => {
        if (where.usedCount?.lte !== undefined && !(usedCount <= where.usedCount.lte)) {
          return { count: 0 }
        }
        if (where.usedCount?.gte !== undefined && !(usedCount >= where.usedCount.gte)) {
          return { count: 0 }
        }
        if (where.usedCount?.gt !== undefined && !(usedCount > where.usedCount.gt)) {
          return { count: 0 }
        }

        if (typeof data.usedCount === 'number') {
          usedCount = data.usedCount
          return { count: 1 }
        }

        if (data.usedCount?.increment) {
          usedCount += data.usedCount.increment
        }
        if (data.usedCount?.decrement) {
          usedCount -= data.usedCount.decrement
        }

        return { count: 1 }
      },
    },
  }

  return {
    tx: tx as never,
    getUsedCount: () => usedCount,
  }
}

describe('discount usage units', () => {
  it('counts total ticket quantity across order items', () => {
    expect(
      getDiscountUsageUnitsFromItems([
        { quantity: 2 },
        { quantity: 3 },
        { quantity: 1 },
      ])
    ).toBe(6)
  })

  it('ignores negative quantities defensively', () => {
    expect(
      getDiscountUsageUnitsFromItems([
        { quantity: 2 },
        { quantity: -5 },
      ])
    ).toBe(2)
  })
})

describe('claimDiscountCodeUsage', () => {
  it('increments by ticket quantity for unlimited codes', async () => {
    const { tx, getUsedCount } = createFakeTx(1)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 4, null)
    expect(claimed).toBe(true)
    expect(getUsedCount()).toBe(5)
  })

  it('fails when limited code does not have enough remaining uses', async () => {
    const { tx, getUsedCount } = createFakeTx(8)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 3, 10)
    expect(claimed).toBe(false)
    expect(getUsedCount()).toBe(8)
  })

  it('succeeds when limited code has enough remaining uses', async () => {
    const { tx, getUsedCount } = createFakeTx(6)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 3, 10)
    expect(claimed).toBe(true)
    expect(getUsedCount()).toBe(9)
  })
})

describe('releaseDiscountCodeUsage', () => {
  it('decrements by ticket quantity when enough used count exists', async () => {
    const { tx, getUsedCount } = createFakeTx(9)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 4)
    expect(released).toBe(4)
    expect(getUsedCount()).toBe(5)
  })

  it('clamps to zero when requested decrement is greater than used count', async () => {
    const { tx, getUsedCount } = createFakeTx(2)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 5)
    expect(released).toBe(5)
    expect(getUsedCount()).toBe(0)
  })

  it('does nothing for zero usage units', async () => {
    const { tx, getUsedCount } = createFakeTx(3)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 0)
    expect(released).toBe(0)
    expect(getUsedCount()).toBe(3)
  })
})
