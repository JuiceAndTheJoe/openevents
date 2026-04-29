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

/**
 * Tax for Tickets (public preview) requires a preview API version. We only pin to it
 * when the feature is enabled — in default mode the SDK uses its built-in version so
 * existing integrations are unaffected.
 *
 * Reference: https://docs.stripe.com/tax/tax-for-tickets/integration-guide
 */
const TAX_FOR_TICKETS_API_VERSION = '2026-03-25.preview'

const DEFAULT_TICKET_TAX_CODE = 'txcd_20030000' // General — Services (required as default)

/**
 * Returns true when the deployment is configured to use Stripe Tax for Tickets — i.e. a
 * performance location ID is set. When enabled:
 *   - automatic_tax is turned on
 *   - the line item is pinned to the performance location so tax follows the venue
 *   - prices are treated as tax-exclusive (Stripe adds VAT on top)
 *   - the line item product gets a tax_code so Stripe Tax can classify it
 *   - billing address + VAT-ID collection are enabled (Stripe Tax requires them)
 *
 * Without STRIPE_PERFORMANCE_LOCATION_ID set the previous behaviour is preserved exactly,
 * so this PR is non-breaking for existing deployments that calculate tax outside Stripe.
 */
export function isStripeTaxForTicketsEnabled(): boolean {
  return Boolean(process.env.STRIPE_PERFORMANCE_LOCATION_ID)
}

let stripeClient: Stripe | null = null
let stripeClientKey: string | null = null
let stripeClientApiVersion: string | null = null

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error('Stripe secret key not configured')
  }

  // Only pin a preview API version when Tax for Tickets is on; otherwise let the SDK
  // use its built-in default to avoid surprising callers that don't need preview.
  const desiredApiVersion = isStripeTaxForTicketsEnabled()
    ? TAX_FOR_TICKETS_API_VERSION
    : null

  if (
    !stripeClient ||
    stripeClientKey !== secretKey ||
    stripeClientApiVersion !== desiredApiVersion
  ) {
    stripeClient = desiredApiVersion
      ? new Stripe(secretKey, {
          // Cast: preview API versions aren't in the SDK's stable type union.
          apiVersion: desiredApiVersion as unknown as Stripe.LatestApiVersion,
        })
      : new Stripe(secretKey)
    stripeClientKey = secretKey
    stripeClientApiVersion = desiredApiVersion
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

  const taxForTickets = isStripeTaxForTicketsEnabled()
  const performanceLocationId = process.env.STRIPE_PERFORMANCE_LOCATION_ID
  const ticketTaxCode = process.env.STRIPE_TAX_CODE || DEFAULT_TICKET_TAX_CODE

  // When Tax for Tickets is on, prices are tax-exclusive (Stripe adds VAT on top).
  // When it's off, behaviour is unchanged from before — the caller decides the tax model.
  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = configuredProductId
    ? {
        currency,
        unit_amount: amountMinor,
        product: configuredProductId,
        ...(taxForTickets ? { tax_behavior: 'exclusive' as const } : {}),
      }
    : {
        currency,
        unit_amount: amountMinor,
        ...(taxForTickets ? { tax_behavior: 'exclusive' as const } : {}),
        product_data: {
          name: options.description || `OpenEvents Order ${options.orderId}`,
          ...(taxForTickets ? { tax_code: ticketTaxCode } : {}),
        },
      }

  // performance_location is a public-preview field on line items — not in the SDK type
  // union for SessionCreateParams.LineItem, so we build the line item via a typed
  // intersection and rely on the rawRequest-style serialization Stripe handles for us.
  type LineItemWithPerformanceLocation = Stripe.Checkout.SessionCreateParams.LineItem & {
    performance_location?: string
  }

  const lineItem: LineItemWithPerformanceLocation = {
    quantity: 1,
    price_data: priceData,
    ...(taxForTickets && performanceLocationId
      ? { performance_location: performanceLocationId }
      : {}),
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    success_url: `${options.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl,
    line_items: [lineItem],
    metadata: {
      orderId: options.orderId,
    },
    payment_intent_data: {
      metadata: {
        orderId: options.orderId,
      },
    },
    ...(taxForTickets
      ? {
          automatic_tax: { enabled: true },
          // Stripe Tax requires a customer record + billing address to compute and report
          // the transaction. Performance location pins the rate, but these fields are still
          // mandated by the API.
          customer_creation: 'always' as const,
          billing_address_collection: 'required' as const,
          // Allow B2B buyers to attach a VAT number — doesn't change the rate (no reverse
          // charge for event admission) but lets the buyer's bookkeeping reference it.
          tax_id_collection: { enabled: true },
        }
      : {}),
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

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
