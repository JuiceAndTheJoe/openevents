/**
 * Smoke test for createStripeCheckoutSession against a real Stripe sandbox.
 *
 * Verifies three regimes back-to-back:
 *   1. Tax for Tickets ON, STRIPE_PRODUCT_ID set     — product id should be ignored
 *   2. Tax for Tickets ON, STRIPE_PRODUCT_ID unset   — inline product_data path
 *   3. Tax for Tickets OFF (regression check)        — original behaviour preserved
 *
 * Run: npx tsx scripts/probe-stripe-tax-for-tickets.ts
 *
 * Loads .env via dotenv at the top of the file (mirrors how tsx runs ad-hoc scripts).
 */
import { config as loadEnv } from 'dotenv'
loadEnv()

import { createStripeCheckoutSession } from '../src/lib/payments/stripe'

async function probe(label: string, orderId: string, description: string) {
  console.log(`\n--- ${label} ---`)
  console.log('STRIPE_PRODUCT_ID:', process.env.STRIPE_PRODUCT_ID || '(unset)')
  console.log('STRIPE_PERFORMANCE_LOCATION_ID:', process.env.STRIPE_PERFORMANCE_LOCATION_ID || '(unset)')
  try {
    const result = await createStripeCheckoutSession({
      orderId,
      amount: 125,
      currency: 'SEK',
      description,
      returnUrl: 'http://localhost:3000/return',
      cancelUrl: 'http://localhost:3000/cancel',
    })
    console.log('OK:', result.checkoutSessionId)
  } catch (e) {
    const err = e as Error
    console.log('ERR:', err.message)
  }
}

;(async () => {
  await probe('1) Tax for Tickets ON + STRIPE_PRODUCT_ID set', 'probe_with_product_id', 'Probe ticket A')

  delete process.env.STRIPE_PRODUCT_ID
  await probe('2) Tax for Tickets ON + STRIPE_PRODUCT_ID unset', 'probe_no_product_id', 'Probe ticket B')

  delete process.env.STRIPE_PERFORMANCE_LOCATION_ID
  await probe('3) Tax for Tickets OFF (regression)', 'probe_legacy', 'Probe ticket C')
})()
