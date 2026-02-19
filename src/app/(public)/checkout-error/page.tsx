import Link from 'next/link'

interface CheckoutErrorPageProps {
  searchParams: Promise<{ error?: string; status?: string }>
}

const errorMessages: Record<string, string> = {
  order_not_found: 'The order could not be found.',
  invalid_token: 'The payment token is invalid or has expired.',
  invalid_status: 'The order is in an invalid state for payment.',
  no_payment_id: 'No payment information was found.',
  not_approved: 'The payment was not approved.',
  capture_failed: 'Failed to capture the payment. Please try again.',
  capture_exception: 'An error occurred while processing your payment.',
  cancel_failed: 'Failed to cancel the order.',
}

export default async function CheckoutErrorPage({ searchParams }: CheckoutErrorPageProps) {
  const params = await searchParams
  const errorCode = params.error || 'unknown'
  const errorMessage = errorMessages[errorCode] || 'An unexpected error occurred during checkout.'

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
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
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-red-800">Payment Error</h1>
        <p className="mb-6 text-red-700">{errorMessage}</p>

        {params.status && (
          <p className="mb-4 text-sm text-red-600">Order status: {params.status}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Go to Homepage
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Browse Events
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        If this problem persists, please contact support.
      </p>
    </main>
  )
}
