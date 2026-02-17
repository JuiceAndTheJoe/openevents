/**
 * Payment Service - Stub Implementation
 *
 * This module provides a stub/mock implementation of payment processing.
 * PayPal integration will be added in a future phase.
 */

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  clientSecret?: string
  paypalOrderId?: string
  createdAt: Date
}

export interface CreatePaymentOptions {
  amount: number
  currency: string
  orderId: string
  description?: string
  returnUrl?: string
  cancelUrl?: string
}

export interface RefundOptions {
  paymentId: string
  amount?: number // Partial refund amount, if not provided = full refund
  reason?: string
}

/**
 * Create a payment intent (stub)
 * In production, this would create a PayPal order
 */
export async function createPaymentIntent(
  options: CreatePaymentOptions
): Promise<PaymentIntent> {
  // Stub implementation - generates a mock payment intent
  const paymentId = `pi_${Date.now()}_${Math.random().toString(36).substring(7)}`

  console.log('[Payment Stub] Creating payment intent:', {
    paymentId,
    amount: options.amount,
    currency: options.currency,
    orderId: options.orderId,
  })

  return {
    id: paymentId,
    amount: options.amount,
    currency: options.currency,
    status: 'pending',
    clientSecret: `secret_${paymentId}`,
    paypalOrderId: `PAYPAL_${paymentId}`,
    createdAt: new Date(),
  }
}

/**
 * Capture a payment (stub)
 * In production, this would capture the PayPal payment
 */
export async function capturePayment(paymentId: string): Promise<PaymentIntent> {
  console.log('[Payment Stub] Capturing payment:', paymentId)

  // Simulate successful payment capture
  return {
    id: paymentId,
    amount: 0, // Would be fetched from actual payment
    currency: 'EUR',
    status: 'completed',
    createdAt: new Date(),
  }
}

/**
 * Cancel a payment (stub)
 */
export async function cancelPayment(paymentId: string): Promise<PaymentIntent> {
  console.log('[Payment Stub] Cancelling payment:', paymentId)

  return {
    id: paymentId,
    amount: 0,
    currency: 'EUR',
    status: 'cancelled',
    createdAt: new Date(),
  }
}

/**
 * Process a refund (stub)
 * In production, this would initiate a PayPal refund
 */
export async function processRefund(options: RefundOptions): Promise<{
  refundId: string
  status: 'pending' | 'processed'
}> {
  console.log('[Payment Stub] Processing refund:', options)

  // In stub mode, refunds are marked as pending for manual processing
  return {
    refundId: `ref_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    status: 'pending',
  }
}

/**
 * Get payment status (stub)
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentIntent | null> {
  console.log('[Payment Stub] Getting payment status:', paymentId)

  // In a real implementation, this would fetch from PayPal
  return null
}

/**
 * Verify webhook signature (stub)
 * In production, this would verify PayPal webhook signatures
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  console.log('[Payment Stub] Verifying webhook signature')
  // Always return true in stub mode
  return true
}

/**
 * Generate a checkout URL for PayPal (stub)
 */
export function getCheckoutUrl(paypalOrderId: string): string {
  // In production, this would return the actual PayPal checkout URL
  const baseUrl = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://www.sandbox.paypal.com'
    : 'https://www.paypal.com'

  return `${baseUrl}/checkoutnow?token=${paypalOrderId}`
}

/**
 * Check if payment is in test/sandbox mode
 */
export function isTestMode(): boolean {
  return process.env.PAYPAL_SANDBOX === 'true' || !process.env.PAYPAL_CLIENT_ID
}
