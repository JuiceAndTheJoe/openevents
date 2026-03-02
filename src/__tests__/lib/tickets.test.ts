/**
 * Tests for ticket and order calculation utilities
 *
 * These are critical financial calculations that must be accurate.
 */
import { describe, it, expect } from 'vitest'
import {
  toMoneyCents,
  fromMoneyCents,
  calculateDiscountAmount,
  calculateOrderTotals,
  getDiscountCodeConsumedTicketCount,
  getDiscountCodeRemainingTicketUses,
  getSelectedTicketQuantity,
  normalizeDiscountCode,
  isDiscountCodeActive,
} from '@/lib/tickets'
import { Prisma, type DiscountCode } from '@prisma/client'

describe('Money Conversion Functions', () => {
  describe('toMoneyCents', () => {
    it('should convert dollars to cents correctly', () => {
      expect(toMoneyCents(10)).toBe(1000)
      expect(toMoneyCents(10.5)).toBe(1050)
      expect(toMoneyCents(10.99)).toBe(1099)
      expect(toMoneyCents(0)).toBe(0)
    })

    it('should handle floating point precision', () => {
      // Classic floating point issue: 0.1 + 0.2 = 0.30000000000000004
      expect(toMoneyCents(0.1 + 0.2)).toBe(30)
      expect(toMoneyCents(10.995)).toBe(1100) // Rounds to nearest cent
    })

    it('should handle negative amounts', () => {
      expect(toMoneyCents(-10)).toBe(-1000)
    })
  })

  describe('fromMoneyCents', () => {
    it('should convert cents to dollars correctly', () => {
      expect(fromMoneyCents(1000)).toBe(10)
      expect(fromMoneyCents(1050)).toBe(10.5)
      expect(fromMoneyCents(1099)).toBe(10.99)
      expect(fromMoneyCents(0)).toBe(0)
    })

    it('should always return two decimal places', () => {
      expect(fromMoneyCents(1000).toString()).toBe('10')
      expect(fromMoneyCents(1001)).toBe(10.01)
    })
  })

  describe('roundtrip conversion', () => {
    it('should maintain precision through conversion cycle', () => {
      const amounts = [0, 1, 10, 10.5, 10.99, 100, 999.99, 1234.56]
      for (const amount of amounts) {
        expect(fromMoneyCents(toMoneyCents(amount))).toBe(amount)
      }
    })
  })
})

describe('Discount Code Functions', () => {
  describe('normalizeDiscountCode', () => {
    it('should uppercase and trim codes', () => {
      expect(normalizeDiscountCode('  summer20  ')).toBe('SUMMER20')
      expect(normalizeDiscountCode('VIP')).toBe('VIP')
      expect(normalizeDiscountCode('early-bird')).toBe('EARLY-BIRD')
    })
  })

  describe('discount use helpers', () => {
    it('should use redeemedTicketCount as consumed ticket uses', () => {
      expect(
        getDiscountCodeConsumedTicketCount({
          redeemedTicketCount: 5,
        })
      ).toBe(5)
    })

    it('should return remaining ticket uses for limited codes', () => {
      expect(
        getDiscountCodeRemainingTicketUses({
          maxUses: 10,
          redeemedTicketCount: 4,
        })
      ).toBe(6)
    })

    it('should sum only the applicable selected ticket quantities', () => {
      expect(
        getSelectedTicketQuantity(
          {
            vip: 2,
            general: 3,
            child: -1,
          },
          ['vip', 'child']
        )
      ).toBe(2)
    })
  })

  describe('isDiscountCodeActive', () => {
    const baseCode: Omit<DiscountCode, 'id' | 'eventId' | 'createdAt' | 'updatedAt'> = {
      code: 'TEST',
      discountType: 'PERCENTAGE',
      discountValue: new Prisma.Decimal(10),
      isActive: true,
      validFrom: null,
      validUntil: null,
      maxUses: null,
      minCartAmount: null,
      usedCount: 0,
      redeemedTicketCount: 0,
    }

    it('should return true for active code with no restrictions', () => {
      const code = { ...baseCode } as DiscountCode
      expect(isDiscountCodeActive(code)).toBe(true)
    })

    it('should return false for inactive code', () => {
      const code = { ...baseCode, isActive: false } as DiscountCode
      expect(isDiscountCodeActive(code)).toBe(false)
    })

    it('should return false if validFrom is in the future', () => {
      const futureDate = new Date(Date.now() + 86400000) // Tomorrow
      const code = { ...baseCode, validFrom: futureDate } as DiscountCode
      expect(isDiscountCodeActive(code)).toBe(false)
    })

    it('should return false if validUntil is in the past', () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      const code = { ...baseCode, validUntil: pastDate } as DiscountCode
      expect(isDiscountCodeActive(code)).toBe(false)
    })

    it('should return false if maxUses reached', () => {
      const code = { ...baseCode, maxUses: 10, redeemedTicketCount: 10 } as DiscountCode
      expect(isDiscountCodeActive(code)).toBe(false)
    })

    it('should return true if maxUses not yet reached', () => {
      const code = { ...baseCode, maxUses: 10, redeemedTicketCount: 9 } as DiscountCode
      expect(isDiscountCodeActive(code)).toBe(true)
    })
  })
})

describe('Discount Calculations', () => {
  describe('calculateDiscountAmount', () => {
    it('should calculate percentage discount correctly', () => {
      expect(calculateDiscountAmount(100, 'PERCENTAGE', 10)).toBe(10)
      expect(calculateDiscountAmount(100, 'PERCENTAGE', 25)).toBe(25)
      expect(calculateDiscountAmount(100, 'PERCENTAGE', 50)).toBe(50)
      expect(calculateDiscountAmount(100, 'PERCENTAGE', 100)).toBe(100)
    })

    it('should handle percentage discount with decimals', () => {
      expect(calculateDiscountAmount(99.99, 'PERCENTAGE', 10)).toBe(10) // Rounds to 10.00
      expect(calculateDiscountAmount(33.33, 'PERCENTAGE', 15)).toBe(5) // 5.00
    })

    it('should calculate fixed amount discount correctly', () => {
      expect(calculateDiscountAmount(100, 'FIXED_AMOUNT', 10)).toBe(10)
      expect(calculateDiscountAmount(100, 'FIXED_AMOUNT', 25)).toBe(25)
    })

    it('should cap fixed discount at subtotal', () => {
      expect(calculateDiscountAmount(50, 'FIXED_AMOUNT', 100)).toBe(50)
    })

    it('should handle FREE_TICKET discount type', () => {
      expect(calculateDiscountAmount(100, 'FREE_TICKET', 0)).toBe(100)
      expect(calculateDiscountAmount(50.5, 'FREE_TICKET', 0)).toBe(50.5)
    })

    it('should return 0 for INVOICE discount type', () => {
      expect(calculateDiscountAmount(100, 'INVOICE', 0)).toBe(0)
    })

    it('should never return negative discount', () => {
      expect(calculateDiscountAmount(0, 'PERCENTAGE', 50)).toBe(0)
      expect(calculateDiscountAmount(0, 'FIXED_AMOUNT', 10)).toBe(0)
    })
  })

  describe('calculateOrderTotals', () => {
    it('should return correct totals without discount', () => {
      const result = calculateOrderTotals(100)
      expect(result).toEqual({
        subtotal: 100,
        discountAmount: 0,
        totalAmount: 100,
      })
    })

    it('should calculate totals with percentage discount', () => {
      const result = calculateOrderTotals(100, 'PERCENTAGE', 20)
      expect(result).toEqual({
        subtotal: 100,
        discountAmount: 20,
        totalAmount: 80,
      })
    })

    it('should calculate totals with fixed discount', () => {
      const result = calculateOrderTotals(100, 'FIXED_AMOUNT', 15)
      expect(result).toEqual({
        subtotal: 100,
        discountAmount: 15,
        totalAmount: 85,
      })
    })

    it('should handle FREE_TICKET discount', () => {
      const result = calculateOrderTotals(100, 'FREE_TICKET', 0)
      expect(result).toEqual({
        subtotal: 100,
        discountAmount: 100,
        totalAmount: 0,
      })
    })

    it('should never return negative total', () => {
      const result = calculateOrderTotals(50, 'FIXED_AMOUNT', 100)
      expect(result.totalAmount).toBe(0)
    })

    it('should handle decimal amounts correctly', () => {
      const result = calculateOrderTotals(99.99, 'PERCENTAGE', 10)
      expect(result.subtotal).toBe(99.99)
      expect(result.totalAmount).toBeGreaterThan(0)
    })
  })
})
