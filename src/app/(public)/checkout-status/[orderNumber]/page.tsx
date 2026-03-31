import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getPaymentStatus, isPaymentProviderConfigured } from '@/lib/payments'

export const dynamic = 'force-dynamic'

interface CheckoutStatusPageProps {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ token?: string; session_id?: string; session_expired?: string }>
}

type OrderStatusInfo = {
  exists: boolean
  orderNumber: string
  status: string | null
  paymentCaptured: boolean
  eventTitle: string | null
  eventSlug: string | null
  buyerEmail: string | null
}

async function getOrderStatus(orderNumber: string, paymentSessionId?: string): Promise<OrderStatusInfo> {
  // Try to find the order by order number
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentId: true,
      buyerEmail: true,
      event: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
  })

  if (!order) {
    return {
      exists: false,
      orderNumber,
      status: null,
      paymentCaptured: false,
      eventTitle: null,
      eventSlug: null,
      buyerEmail: null,
    }
  }

  // Check if payment was captured
  let paymentCaptured = order.status === 'PAID'

  // If we have a payment session id and order is not yet paid, check with provider
  if (!paymentCaptured && paymentSessionId && isPaymentProviderConfigured()) {
    try {
      const paymentStatus = await getPaymentStatus(paymentSessionId)
      paymentCaptured = paymentStatus.isApproved
    } catch {
      // Provider check failed, rely on our database status
      console.log('[CheckoutStatus] Could not verify payment status')
    }
  }

  return {
    exists: true,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentCaptured,
    eventTitle: order.event.title,
    eventSlug: order.event.slug,
    buyerEmail: order.buyerEmail,
  }
}

export default async function CheckoutStatusPage({ params, searchParams }: CheckoutStatusPageProps) {
  const { orderNumber } = await params
  const { token, session_id, session_expired } = await searchParams

  const orderStatus = await getOrderStatus(orderNumber, session_id || token)

  // Determine what message to show
  const isSessionExpired = session_expired === 'true'

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {/* Header */}
        <div className="mb-6 text-center">
          {orderStatus.paymentCaptured ? (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
          ) : orderStatus.exists ? (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg
                className="h-6 w-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          )}

          <h1 className="text-xl font-semibold text-gray-900">
            {orderStatus.paymentCaptured
              ? 'Payment Successful'
              : orderStatus.exists
                ? 'Order Status'
                : 'Order Not Found'}
          </h1>
        </div>

        {/* Session expired notice */}
        {isSessionExpired && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Your session has expired, but don&apos;t worry - your order was saved. You can view your order details using the link below.
            </p>
          </div>
        )}

        {/* Order status details */}
        <div className="mb-6 space-y-4">
          {orderStatus.exists ? (
            <>
              <div className="rounded-md bg-gray-50 p-4">
                <h2 className="mb-2 text-sm font-medium text-gray-700">Order Information</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Order Number</dt>
                    <dd className="font-medium text-gray-900">{orderStatus.orderNumber}</dd>
                  </div>
                  {orderStatus.eventTitle && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Event</dt>
                      <dd className="font-medium text-gray-900">{orderStatus.eventTitle}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Payment Status</dt>
                    <dd
                      className={`font-medium ${
                        orderStatus.paymentCaptured
                          ? 'text-green-600'
                          : orderStatus.status === 'PENDING'
                            ? 'text-amber-600'
                            : orderStatus.status === 'CANCELLED' || orderStatus.status === 'EXPIRED'
                              ? 'text-red-600'
                              : 'text-gray-900'
                      }`}
                    >
                      {orderStatus.paymentCaptured
                        ? 'Payment Captured'
                        : orderStatus.status === 'PENDING'
                          ? 'Payment Pending'
                          : orderStatus.status === 'PENDING_INVOICE'
                            ? 'Invoice Pending'
                            : orderStatus.status === 'CANCELLED'
                              ? 'Cancelled'
                              : orderStatus.status === 'EXPIRED'
                                ? 'Expired'
                                : orderStatus.status}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Next steps */}
              <div className="rounded-md bg-blue-50 p-4">
                <h2 className="mb-2 text-sm font-medium text-blue-800">What to do next</h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-blue-700">
                  {orderStatus.paymentCaptured ? (
                    <>
                      <li>Your payment has been successfully processed</li>
                      <li>View your order details and tickets using the link below</li>
                      {orderStatus.buyerEmail && (
                        <li>A confirmation email has been sent to {orderStatus.buyerEmail}</li>
                      )}
                    </>
                  ) : orderStatus.status === 'PENDING' ? (
                    <>
                      <li>Your order reservation is still active</li>
                      <li>Complete your payment to receive your tickets</li>
                      <li>Note: Reservations expire after a short time</li>
                    </>
                  ) : orderStatus.status === 'PENDING_INVOICE' ? (
                    <>
                      <li>Your invoice order has been created</li>
                      <li>View your order details using the link below</li>
                    </>
                  ) : orderStatus.status === 'CANCELLED' ? (
                    <>
                      <li>This order was cancelled</li>
                      <li>You can start a new checkout if you still want tickets</li>
                    </>
                  ) : orderStatus.status === 'EXPIRED' ? (
                    <>
                      <li>This order reservation has expired</li>
                      <li>You can start a new checkout to try again</li>
                    </>
                  ) : (
                    <li>View your order status using the link below</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">
                We could not find an order with number <strong>{orderNumber}</strong>.
                Please check the order number or contact support if you believe this is an error.
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {orderStatus.exists && (
            <Link
              href={`/orders/${orderStatus.orderNumber}`}
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              View order details
            </Link>
          )}
          {orderStatus.eventSlug && (
            <Link
              href={`/events/${orderStatus.eventSlug}`}
              className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to event
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go to homepage
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Need help? <Link href="/support" className="text-blue-600 hover:underline">Contact support</Link>
      </p>
    </main>
  )
}
