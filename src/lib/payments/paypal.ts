/**
 * PayPal REST API Integration
 *
 * Uses PayPal REST API v2 for:
 * - Creating orders
 * - Capturing payments
 * - Processing refunds
 * - Verifying webhooks
 */

const PAYPAL_API_BASE = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com'

interface PayPalTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface PayPalOrderLink {
  href: string
  rel: string
  method: string
}

interface PayPalPurchaseUnit {
  reference_id?: string
  description?: string
  amount: {
    currency_code: string
    value: string
  }
}

interface PayPalOrderResponse {
  id: string
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED'
  links: PayPalOrderLink[]
  purchase_units?: PayPalPurchaseUnit[]
}

interface PayPalCaptureResponse {
  id: string
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED' | 'FAILED'
  purchase_units?: Array<{
    reference_id?: string
    payments?: {
      captures?: Array<{
        id: string
        status: string
        amount: {
          currency_code: string
          value: string
        }
      }>
    }
  }>
}

interface PayPalRefundResponse {
  id: string
  status: 'CANCELLED' | 'FAILED' | 'PENDING' | 'COMPLETED'
  amount?: {
    currency_code: string
    value: string
  }
}

// Token cache to avoid requesting new tokens for every API call
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get PayPal API access token using client credentials
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token
  }

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured')
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[PayPal] Token request failed:', error)
    throw new Error('Failed to get PayPal access token')
  }

  const data: PayPalTokenResponse = await response.json()

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

export interface CreatePayPalOrderOptions {
  orderId: string
  amount: number
  currency: string
  description?: string
  returnUrl: string
  cancelUrl: string
}

/**
 * Create a PayPal order and return the approval URL
 */
export async function createPayPalOrder(
  options: CreatePayPalOrderOptions
): Promise<{ paypalOrderId: string; approvalUrl: string }> {
  const accessToken = await getAccessToken()

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: options.orderId,
        description: options.description || `OpenEvents Order`,
        amount: {
          currency_code: options.currency,
          value: options.amount.toFixed(2),
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'OpenEvents',
          locale: 'en-US',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: options.returnUrl,
          cancel_url: options.cancelUrl,
        },
      },
    },
  }

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `openevents-create-${options.orderId}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[PayPal] Create order failed:', error)
    throw new Error('Failed to create PayPal order')
  }

  const data: PayPalOrderResponse = await response.json()

  // Find the approval URL (payer-action link)
  const approvalLink = data.links.find(
    (link) => link.rel === 'payer-action' || link.rel === 'approve'
  )

  if (!approvalLink) {
    console.error('[PayPal] No approval URL in response:', data)
    throw new Error('PayPal did not return an approval URL')
  }

  console.log('[PayPal] Order created:', {
    paypalOrderId: data.id,
    status: data.status,
    approvalUrl: approvalLink.href,
  })

  return {
    paypalOrderId: data.id,
    approvalUrl: approvalLink.href,
  }
}

/**
 * Capture a PayPal order after the payer approves it
 */
export async function capturePayPalOrder(
  paypalOrderId: string
): Promise<{ captureId: string; status: string; amount: string; currency: string }> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[PayPal] Capture failed:', error)
    throw new Error('Failed to capture PayPal payment')
  }

  const data: PayPalCaptureResponse = await response.json()

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0]

  if (!capture) {
    console.error('[PayPal] No capture in response:', data)
    throw new Error('PayPal capture response missing capture details')
  }

  console.log('[PayPal] Payment captured:', {
    captureId: capture.id,
    status: capture.status,
    amount: capture.amount.value,
    currency: capture.amount.currency_code,
  })

  return {
    captureId: capture.id,
    status: capture.status,
    amount: capture.amount.value,
    currency: capture.amount.currency_code,
  }
}

/**
 * Get PayPal order details
 */
export async function getPayPalOrder(paypalOrderId: string): Promise<PayPalOrderResponse> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[PayPal] Get order failed:', error)
    throw new Error('Failed to get PayPal order')
  }

  return response.json()
}

export interface RefundPayPalOptions {
  captureId: string
  amount?: number
  currency?: string
  reason?: string
}

/**
 * Refund a captured payment
 */
export async function refundPayPalPayment(
  options: RefundPayPalOptions
): Promise<{ refundId: string; status: string }> {
  const accessToken = await getAccessToken()

  const payload: Record<string, unknown> = {}

  // If amount specified, it's a partial refund
  if (options.amount !== undefined && options.currency) {
    payload.amount = {
      currency_code: options.currency,
      value: options.amount.toFixed(2),
    }
  }

  if (options.reason) {
    payload.note_to_payer = options.reason
  }

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/payments/captures/${options.captureId}/refund`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `openevents-refund-${options.captureId}-${options.amount?.toFixed(2) ?? 'full'}`,
      },
      body: JSON.stringify(payload),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[PayPal] Refund failed:', error)
    throw new Error('Failed to refund PayPal payment')
  }

  const data: PayPalRefundResponse = await response.json()

  console.log('[PayPal] Refund processed:', {
    refundId: data.id,
    status: data.status,
  })

  return {
    refundId: data.id,
    status: data.status,
  }
}

export interface PayPalWebhookEvent {
  id: string
  event_type: string
  resource_type: string
  resource: Record<string, unknown>
  create_time: string
}

/**
 * Verify PayPal webhook signature
 *
 * Note: For production, you should verify webhooks using PayPal's
 * webhook verification API. For sandbox, we do basic validation.
 */
export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string,
  webhookId: string
): Promise<boolean> {
  const accessToken = await getAccessToken()

  const verifyPayload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: JSON.parse(body),
  }

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyPayload),
    }
  )

  if (!response.ok) {
    console.error('[PayPal] Webhook verification request failed')
    return false
  }

  const data = await response.json()
  return data.verification_status === 'SUCCESS'
}

/**
 * Check if PayPal is properly configured
 */
export function isPayPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
}

/**
 * Check if running in sandbox mode
 */
export function isPayPalSandbox(): boolean {
  return process.env.PAYPAL_SANDBOX === 'true'
}
