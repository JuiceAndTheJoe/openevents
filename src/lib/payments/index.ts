/**
 * Payment Service
 *
 * This module provides payment processing using Stripe Checkout.
 * Falls back to stub mode if Stripe credentials are not configured.
 */

import {
  createStripeCheckoutSession,
  captureStripeCheckoutSession,
  refundStripePayment,
  getStripePaymentStatus,
  isStripeConfigured,
  isStripeTestMode,
} from './stripe'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  approvalUrl?: string
  createdAt: Date
}

export interface CreatePaymentOptions {
  amount: number
  currency: string
  orderId: string
  description?: string
  returnUrl: string
  cancelUrl: string
}

export interface CapturePaymentResult {
  captureId: string
  status: PaymentStatus
  amount: number
  currency: string
}

export interface RefundOptions {
  captureId: string
  amount?: number
  currency?: string
  reason?: string
}

export interface RefundResult {
  refundId: string
  status: 'pending' | 'completed' | 'failed'
}

/**
 * Create a payment intent
 *
 * For Stripe: Creates a checkout session and returns the checkout URL for redirect
 * For stub mode: Returns a mock payment intent
 */
export async function createPaymentIntent(
  options: CreatePaymentOptions
): Promise<PaymentIntent> {
  if (isStripeConfigured()) {
    const result = await createStripeCheckoutSession({
      orderId: options.orderId,
      amount: options.amount,
      currency: options.currency,
      description: options.description,
      returnUrl: options.returnUrl,
      cancelUrl: options.cancelUrl,
    })

    return {
      id: result.checkoutSessionId,
      amount: options.amount,
      currency: options.currency,
      status: 'pending',
      approvalUrl: result.checkoutUrl,
      createdAt: new Date(),
    }
  }

  // Stub mode for development without Stripe credentials
  console.log('[Payment Stub] Creating payment intent:', {
    amount: options.amount,
    currency: options.currency,
    orderId: options.orderId,
  })

  const stubId = `stub_${Date.now()}_${Math.random().toString(36).substring(7)}`

  return {
    id: stubId,
    amount: options.amount,
    currency: options.currency,
    status: 'pending',
    approvalUrl: `${options.returnUrl}?token=${stubId}`,
    createdAt: new Date(),
  }
}

/**
 * Capture a payment after user approval
 *
 * For Stripe Checkout: verifies completed session and returns payment intent id
 * For stub mode: Returns mock success
 */
export async function capturePayment(
  paymentSessionId: string
): Promise<CapturePaymentResult> {
  if (isStripeConfigured()) {
    const result = await captureStripeCheckoutSession(paymentSessionId)

    return {
      captureId: result.captureId,
      status: result.status === 'COMPLETED' ? 'completed' : 'failed',
      amount: parseFloat(result.amount),
      currency: result.currency,
    }
  }

  // Stub mode
  console.log('[Payment Stub] Capturing payment:', paymentSessionId)

  return {
    captureId: `cap_${paymentSessionId}`,
    status: 'completed',
    amount: 0,
    currency: 'SEK',
  }
}

/**
 * Get payment/session status
 */
export async function getPaymentStatus(
  paymentSessionId: string
): Promise<{ status: string; isApproved: boolean }> {
  if (isStripeConfigured()) {
    return getStripePaymentStatus(paymentSessionId)
  }

  // Stub mode - always approved
  return {
    status: 'complete:paid',
    isApproved: true,
  }
}

/**
 * Process a refund
 *
 * For Stripe: Initiates a refund via Stripe API
 * For stub mode: Returns pending status
 */
export async function processRefund(options: RefundOptions): Promise<RefundResult> {
  if (isStripeConfigured()) {
    const result = await refundStripePayment({
      captureId: options.captureId,
      amount: options.amount,
      currency: options.currency,
      reason: options.reason,
    })

    return {
      refundId: result.refundId,
      status:
        result.status === 'COMPLETED'
          ? 'completed'
          : result.status === 'FAILED'
            ? 'failed'
            : 'pending',
    }
  }

  // Stub mode
  console.log('[Payment Stub] Processing refund:', options)

  return {
    refundId: `ref_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    status: 'pending',
  }
}

/**
 * Cancel a pending payment
 */
export async function cancelPayment(paymentSessionId: string): Promise<void> {
  // Stripe checkout sessions that are not completed do not require explicit cancellation.
  console.log('[Payment] Cancelling payment:', paymentSessionId)
}

/**
 * Check if payment is in test/sandbox mode
 */
export function isTestMode(): boolean {
  return isStripeTestMode() || !isStripeConfigured()
}

/**
 * Check if Stripe is configured
 */
export const isPaymentProviderConfigured = isStripeConfigured

/**
 * Generate URLs for redirect payment flow
 */
export function generatePaymentUrls(
  baseUrl: string,
  orderId: string
): { returnUrl: string; cancelUrl: string } {
  return {
    returnUrl: `${baseUrl}/api/orders/${orderId}/capture`,
    cancelUrl: `${baseUrl}/api/orders/${orderId}/cancel`,
  }
}
