/**
 * Payment Service
 *
 * This module provides payment processing using PayPal REST API.
 * Falls back to stub mode if PayPal credentials are not configured.
 */

import {
  createPayPalOrder,
  capturePayPalOrder,
  refundPayPalPayment,
  getPayPalOrder,
  isPayPalConfigured,
  isPayPalSandbox,
  type CreatePayPalOrderOptions,
} from './paypal'

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  paypalOrderId?: string
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
 * For PayPal: Creates an order and returns the approval URL for redirect
 * For stub mode: Returns a mock payment intent
 */
export async function createPaymentIntent(
  options: CreatePaymentOptions
): Promise<PaymentIntent> {
  // Use real PayPal if configured
  if (isPayPalConfigured()) {
    const paypalOptions: CreatePayPalOrderOptions = {
      orderId: options.orderId,
      amount: options.amount,
      currency: options.currency,
      description: options.description,
      returnUrl: options.returnUrl,
      cancelUrl: options.cancelUrl,
    }

    const result = await createPayPalOrder(paypalOptions)

    return {
      id: result.paypalOrderId,
      amount: options.amount,
      currency: options.currency,
      status: 'pending',
      paypalOrderId: result.paypalOrderId,
      approvalUrl: result.approvalUrl,
      createdAt: new Date(),
    }
  }

  // Stub mode for development without PayPal credentials
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
    paypalOrderId: stubId,
    // In stub mode, simulate approval URL pointing back to our capture endpoint
    approvalUrl: `${options.returnUrl}?token=${stubId}`,
    createdAt: new Date(),
  }
}

/**
 * Capture a payment after user approval
 *
 * For PayPal: Captures the approved order
 * For stub mode: Returns mock success
 */
export async function capturePayment(
  paypalOrderId: string
): Promise<CapturePaymentResult> {
  // Use real PayPal if configured
  if (isPayPalConfigured()) {
    const result = await capturePayPalOrder(paypalOrderId)

    return {
      captureId: result.captureId,
      status: result.status === 'COMPLETED' ? 'completed' : 'failed',
      amount: parseFloat(result.amount),
      currency: result.currency,
    }
  }

  // Stub mode
  console.log('[Payment Stub] Capturing payment:', paypalOrderId)

  return {
    captureId: `cap_${paypalOrderId}`,
    status: 'completed',
    amount: 0,
    currency: 'SEK',
  }
}

/**
 * Get payment/order status
 */
export async function getPaymentStatus(
  paypalOrderId: string
): Promise<{ status: string; isApproved: boolean }> {
  if (isPayPalConfigured()) {
    const order = await getPayPalOrder(paypalOrderId)
    return {
      status: order.status,
      isApproved: order.status === 'APPROVED' || order.status === 'COMPLETED',
    }
  }

  // Stub mode - always approved
  return {
    status: 'APPROVED',
    isApproved: true,
  }
}

/**
 * Process a refund
 *
 * For PayPal: Initiates a refund via PayPal API
 * For stub mode: Returns pending status
 */
export async function processRefund(options: RefundOptions): Promise<RefundResult> {
  if (isPayPalConfigured()) {
    const result = await refundPayPalPayment({
      captureId: options.captureId,
      amount: options.amount,
      currency: options.currency,
      reason: options.reason,
    })

    return {
      refundId: result.refundId,
      status: result.status === 'COMPLETED' ? 'completed' : 'pending',
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
export async function cancelPayment(paypalOrderId: string): Promise<void> {
  // PayPal orders that are not captured will automatically void
  // No explicit action needed, but we log it
  console.log('[Payment] Cancelling payment:', paypalOrderId)
}

/**
 * Check if payment is in test/sandbox mode
 */
export function isTestMode(): boolean {
  return isPayPalSandbox() || !isPayPalConfigured()
}

/**
 * Check if PayPal is configured
 */
export { isPayPalConfigured }

/**
 * Generate URLs for PayPal redirect flow
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
