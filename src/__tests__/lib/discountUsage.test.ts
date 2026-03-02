import { describe, it, expect } from 'vitest'
import {
  claimDiscountCodeUsage,
  getDiscountUsageUnitsFromItems,
  releaseDiscountCodeUsage,
} from '@/lib/orders/discountUsage'

function createFakeTx(initialUsedCount: number, initialRedeemedTicketCount: number = initialUsedCount) {
  let usedCount = initialUsedCount
  let redeemedTicketCount = initialRedeemedTicketCount

  const tx = {
    discountCode: {
      findUnique: async () => ({ usedCount, redeemedTicketCount }),
      update: async ({
        data,
      }: {
        data: {
          usedCount?: { increment?: number } | number
          redeemedTicketCount?: { increment?: number } | number
        }
      }) => {
        if (typeof data.usedCount === 'number') {
          usedCount = data.usedCount
        }
        if (typeof data.redeemedTicketCount === 'number') {
          redeemedTicketCount = data.redeemedTicketCount
        }
        if (typeof data.usedCount === 'object' && data.usedCount?.increment) {
          usedCount += data.usedCount.increment
        }
        if (
          typeof data.redeemedTicketCount === 'object' &&
          data.redeemedTicketCount?.increment
        ) {
          redeemedTicketCount += data.redeemedTicketCount.increment
        }
        return { id: 'dc-1', usedCount, redeemedTicketCount }
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string
          usedCount?: { gte?: number; gt?: number; lte?: number }
          redeemedTicketCount?: { lte?: number; gte?: number; gt?: number }
        }
        data: {
          usedCount?: { increment?: number; decrement?: number } | number
          redeemedTicketCount?: { increment?: number; decrement?: number } | number
        }
      }) => {
        if (where.usedCount?.gte !== undefined && !(usedCount >= where.usedCount.gte)) {
          return { count: 0 }
        }
        if (where.usedCount?.gt !== undefined && !(usedCount > where.usedCount.gt)) {
          return { count: 0 }
        }
        if (where.usedCount?.lte !== undefined && !(usedCount <= where.usedCount.lte)) {
          return { count: 0 }
        }
        if (
          where.redeemedTicketCount?.lte !== undefined &&
          !(redeemedTicketCount <= where.redeemedTicketCount.lte)
        ) {
          return { count: 0 }
        }
        if (
          where.redeemedTicketCount?.gte !== undefined &&
          !(redeemedTicketCount >= where.redeemedTicketCount.gte)
        ) {
          return { count: 0 }
        }
        if (
          where.redeemedTicketCount?.gt !== undefined &&
          !(redeemedTicketCount > where.redeemedTicketCount.gt)
        ) {
          return { count: 0 }
        }

        if (typeof data.usedCount === 'number') {
          usedCount = data.usedCount
        }
        if (typeof data.redeemedTicketCount === 'number') {
          redeemedTicketCount = data.redeemedTicketCount
        }

        if (typeof data.usedCount === 'object' && data.usedCount?.increment) {
          usedCount += data.usedCount.increment
        }
        if (typeof data.usedCount === 'object' && data.usedCount?.decrement) {
          usedCount -= data.usedCount.decrement
        }
        if (
          typeof data.redeemedTicketCount === 'object' &&
          data.redeemedTicketCount?.increment
        ) {
          redeemedTicketCount += data.redeemedTicketCount.increment
        }
        if (
          typeof data.redeemedTicketCount === 'object' &&
          data.redeemedTicketCount?.decrement
        ) {
          redeemedTicketCount -= data.redeemedTicketCount.decrement
        }

        return { count: 1 }
      },
    },
  }

  return {
    tx: tx as never,
    getUsedCount: () => usedCount,
    getRedeemedTicketCount: () => redeemedTicketCount,
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
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(1)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 4, null)
    expect(claimed).toBe(true)
    expect(getUsedCount()).toBe(5)
    expect(getRedeemedTicketCount()).toBe(5)
  })

  it('fails when limited code does not have enough remaining uses', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(8)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 3, 10)
    expect(claimed).toBe(false)
    expect(getUsedCount()).toBe(8)
    expect(getRedeemedTicketCount()).toBe(8)
  })

  it('succeeds when limited code has enough remaining uses', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(6)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 3, 10)
    expect(claimed).toBe(true)
    expect(getUsedCount()).toBe(9)
    expect(getRedeemedTicketCount()).toBe(9)
  })

  it('ignores the legacy usedCount when enforcing limited codes', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(8, 1)
    const claimed = await claimDiscountCodeUsage(tx, 'dc-1', 3, 10)
    expect(claimed).toBe(true)
    expect(getUsedCount()).toBe(11)
    expect(getRedeemedTicketCount()).toBe(4)
  })

  it('does not oversubscribe when two claims compete for the final ticket uses', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(0, 0)

    expect(await claimDiscountCodeUsage(tx, 'dc-1', 2, 3)).toBe(true)
    expect(await claimDiscountCodeUsage(tx, 'dc-1', 2, 3)).toBe(false)
    expect(getUsedCount()).toBe(2)
    expect(getRedeemedTicketCount()).toBe(2)
  })

  it('does not consume twice when the same full-quantity claim is retried', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(0, 0)

    expect(await claimDiscountCodeUsage(tx, 'dc-1', 3, 3)).toBe(true)
    expect(await claimDiscountCodeUsage(tx, 'dc-1', 3, 3)).toBe(false)
    expect(getUsedCount()).toBe(3)
    expect(getRedeemedTicketCount()).toBe(3)
  })
})

describe('releaseDiscountCodeUsage', () => {
  it('decrements by ticket quantity when enough used count exists', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(9)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 4)
    expect(released).toBe(4)
    expect(getUsedCount()).toBe(5)
    expect(getRedeemedTicketCount()).toBe(5)
  })

  it('clamps to zero when requested decrement is greater than used count', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(2)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 5)
    expect(released).toBe(5)
    expect(getUsedCount()).toBe(0)
    expect(getRedeemedTicketCount()).toBe(0)
  })

  it('does nothing for zero usage units', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(3)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 0)
    expect(released).toBe(0)
    expect(getUsedCount()).toBe(3)
    expect(getRedeemedTicketCount()).toBe(3)
  })

  it('clamps each counter independently when they drift', async () => {
    const { tx, getUsedCount, getRedeemedTicketCount } = createFakeTx(2, 7)
    const released = await releaseDiscountCodeUsage(tx, 'dc-1', 5)
    expect(released).toBe(5)
    expect(getUsedCount()).toBe(0)
    expect(getRedeemedTicketCount()).toBe(2)
  })
})
