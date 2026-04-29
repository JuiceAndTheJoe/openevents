/**
 * Tests for the Stripe Tax for Tickets feature flag.
 *
 * Full integration coverage of Checkout Session params would require mocking the Stripe
 * SDK; here we cover the deterministic logic — `isStripeTaxForTicketsEnabled` — and pin
 * its contract so accidental regressions in the feature gate are caught.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isStripeTaxForTicketsEnabled } from '@/lib/payments/stripe'

describe('isStripeTaxForTicketsEnabled', () => {
  const originalLocationId = process.env.STRIPE_PERFORMANCE_LOCATION_ID

  beforeEach(() => {
    delete process.env.STRIPE_PERFORMANCE_LOCATION_ID
  })

  afterEach(() => {
    if (originalLocationId === undefined) {
      delete process.env.STRIPE_PERFORMANCE_LOCATION_ID
    } else {
      process.env.STRIPE_PERFORMANCE_LOCATION_ID = originalLocationId
    }
  })

  it('returns false when STRIPE_PERFORMANCE_LOCATION_ID is unset', () => {
    expect(isStripeTaxForTicketsEnabled()).toBe(false)
  })

  it('returns false when STRIPE_PERFORMANCE_LOCATION_ID is empty', () => {
    process.env.STRIPE_PERFORMANCE_LOCATION_ID = ''
    expect(isStripeTaxForTicketsEnabled()).toBe(false)
  })

  it('returns true when STRIPE_PERFORMANCE_LOCATION_ID is set to a non-empty value', () => {
    process.env.STRIPE_PERFORMANCE_LOCATION_ID = 'taxloc_test123'
    expect(isStripeTaxForTicketsEnabled()).toBe(true)
  })
})
