import Stripe from 'stripe'

export interface CreateStripeCheckoutSessionOptions {
  orderId: string
  amount: number
  currency: string
  description?: string
  returnUrl: string
  cancelUrl: string
}

export interface StripeCheckoutSessionResult {
  checkoutSessionId: string
  checkoutUrl: string
}

export interface StripeCaptureResult {
  captureId: string
  status: 'COMPLETED' | 'FAILED'
  amount: string
  currency: string
}

export interface RefundStripeOptions {
  captureId: string
  amount?: number
  currency?: string
  reason?: string
}

export interface StripeRefundResult {
  refundId: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
])

let stripeClient: Stripe | null = null
let stripeClientKey: string | null = null

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error('Stripe secret key not configured')
  }

  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey)
    stripeClientKey = secretKey
  }

  return stripeClient
}

function toMinorUnits(amount: number, currency: string): number {
  const normalizedCurrency = currency.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

function fromMinorUnits(amount: number, currency: string): number {
  const normalizedCurrency = currency.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return amount
  }
  return amount / 100
}

function asPaymentIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | null {
  if (!paymentIntent) return null
  if (typeof paymentIntent === 'string') return paymentIntent
  return paymentIntent.id
}

export async function createStripeCheckoutSession(
  options: CreateStripeCheckoutSessionOptions
): Promise<StripeCheckoutSessionResult> {
  const stripe = getStripeClient()
  const amountMinor = toMinorUnits(options.amount, options.currency)
  const currency = options.currency.toLowerCase()
  const configuredProductId = process.env.STRIPE_PRODUCT_ID

  // `unit_amount` is the gross (VAT-inclusive) total — see prepareOrderItems in
  // src/lib/orders/index.ts. Stripe Tax must therefore treat the price as
  // tax-inclusive and back-calculate the VAT portion from the buyer's location.
  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = configuredProductId
    ? {
        currency,
        unit_amount: amountMinor,
        tax_behavior: 'inclusive',
        product: configuredProductId,
      }
    : {
        currency,
        unit_amount: amountMinor,
        tax_behavior: 'inclusive',
        product_data: {
          name: options.description || `OpenEvents Order ${options.orderId}`,
          tax_code: 'txcd_10000000',
        },
      }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${options.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: priceData,
      },
    ],
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    metadata: {
      orderId: options.orderId,
    },
    payment_intent_data: {
      metadata: {
        orderId: options.orderId,
      },
    },
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }

  return {
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
  }
}

export async function getStripeCheckoutSession(sessionId: string) {
  const stripe = getStripeClient()

  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  })
}

export async function captureStripeCheckoutSession(
  sessionId: string
): Promise<StripeCaptureResult> {
  const session = await getStripeCheckoutSession(sessionId)

  const isCompleted = session.status === 'complete' && session.payment_status === 'paid'
  const paymentIntentId = asPaymentIntentId(session.payment_intent)

  return {
    captureId: paymentIntentId || session.id,
    status: isCompleted ? 'COMPLETED' : 'FAILED',
    amount: fromMinorUnits(session.amount_total || 0, (session.currency || 'sek').toUpperCase()).toFixed(2),
    currency: (session.currency || 'sek').toUpperCase(),
  }
}

export async function getStripePaymentStatus(
  sessionId: string
): Promise<{ status: string; isApproved: boolean }> {
  const session = await getStripeCheckoutSession(sessionId)
  const isApproved = session.status === 'complete' && session.payment_status === 'paid'

  return {
    status: `${session.status}:${session.payment_status}`,
    isApproved,
  }
}

export async function refundStripePayment(
  options: RefundStripeOptions
): Promise<StripeRefundResult> {
  const stripe = getStripeClient()

  const refund = await stripe.refunds.create({
    payment_intent: options.captureId,
    amount:
      typeof options.amount === 'number' && options.currency
        ? toMinorUnits(options.amount, options.currency)
        : undefined,
    metadata: options.reason
      ? {
          reason: options.reason,
        }
      : undefined,
  })

  let status: StripeRefundResult['status'] = 'PENDING'

  if (refund.status === 'succeeded') {
    status = 'COMPLETED'
  } else if (refund.status === 'failed' || refund.status === 'canceled') {
    status = 'FAILED'
  }

  return {
    refundId: refund.id,
    status,
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function isStripeTestMode(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  return secretKey.startsWith('sk_test_') || !secretKey
}
