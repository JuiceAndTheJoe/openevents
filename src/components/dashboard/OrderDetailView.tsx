'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { formatPaymentMethodLabel } from '@/lib/payments/labels'

type OrderDetailViewProps = {
  order: {
    id: string
    orderNumber: string
    status: string
    paymentMethod: string | null
    buyerFirstName: string
    buyerLastName: string
    buyerEmail: string
    totalAmount: number
    subtotal: number
    discountAmount: number
    currency: string
    createdAt: Date
    invoiceSentAt?: Date | null
    discountCode?: string | null
    items: Array<{
      id: string
      quantity: number
      unitPrice: number
      totalPrice: number
      ticketType: {
        name: string
      }
    }>
  }
  refundAction: (formData: FormData) => Promise<void>
  emailAction: (formData: FormData) => Promise<void>
  markPaidAction?: (formData: FormData) => Promise<void>
  markInvoiceSentAction?: (formData: FormData) => Promise<void>
  deleteOrderAction?: (formData: FormData) => Promise<void>
}

export function OrderDetailView({ order, refundAction, emailAction, markPaidAction, markInvoiceSentAction, deleteOrderAction }: OrderDetailViewProps) {
  const isPendingInvoice = order.status === 'PENDING_INVOICE'
  const showMarkInvoiceSent = isPendingInvoice && !order.invoiceSentAt && markInvoiceSentAction
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-gray-900">Order {order.orderNumber}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {order.status} · {formatPaymentMethodLabel(order.paymentMethod, 'No payment method')} · {formatDateTime(order.createdAt)}
        </p>
        {order.paymentMethod === 'INVOICE' && (
          <p className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            Invoice order, confirm payment externally
          </p>
        )}
        {order.paymentMethod === 'FREE' && order.discountCode && (
          <p className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            Free order &mdash; discount code: {order.discountCode}
          </p>
        )}
        {isPendingInvoice && (
          <p className="mt-2 text-sm">
            {order.invoiceSentAt ? (
              <span className="text-green-600">Invoice sent on {formatDateTime(order.invoiceSentAt)}</span>
            ) : (
              <span className="text-amber-600">Invoice not yet sent</span>
            )}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Buyer</h2>
            <p className="text-sm text-gray-700">{order.buyerFirstName} {order.buyerLastName}</p>
            <p className="text-sm text-gray-600">{order.buyerEmail}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Totals</h2>
            <p className="text-sm text-gray-700">Subtotal: {formatCurrency(order.subtotal, order.currency)}</p>
            <p className="text-sm text-gray-700">Discount: {formatCurrency(order.discountAmount, order.currency)}</p>
            <p className="text-sm font-semibold text-gray-900">Total: {formatCurrency(order.totalAmount, order.currency)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm">
              <p className="font-medium text-gray-900">{item.ticketType.name}</p>
              <p className="text-gray-600">Qty {item.quantity} × {formatCurrency(item.unitPrice, order.currency)} = {formatCurrency(item.totalPrice, order.currency)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {showMarkInvoiceSent && (
            <form action={markInvoiceSentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Mark Invoice Sent
              </Button>
            </form>
          )}
          {isPendingInvoice && markPaidAction && (
            <form action={markPaidAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Mark as Paid
              </Button>
            </form>
          )}
          <form action={refundAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button variant="outline" type="submit">Mark Refund Pending</Button>
          </form>
          <SendEmailButton orderId={order.id} action={emailAction} />
          {deleteOrderAction && (
            <DeleteOrderButton orderId={order.id} action={deleteOrderAction} />
          )}
        </div>
      </section>
    </div>
  )
}

function SendEmailButton({ orderId, action }: { orderId: string; action: (formData: FormData) => Promise<void> }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    try {
      const formData = new FormData(e.currentTarget)
      await action(formData)
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="orderId" value={orderId} />
        <Button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending...' : 'Send Email to Buyer'}
        </Button>
      </form>
      {status === 'sent' && (
        <span className="text-sm font-medium text-green-600">Email sent!</span>
      )}
      {status === 'error' && (
        <span className="text-sm font-medium text-red-600">Failed to send email</span>
      )}
    </div>
  )
}

function DeleteOrderButton({ orderId, action }: { orderId: string; action: (formData: FormData) => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Are you sure you want to permanently delete this order? This cannot be undone.')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
        Delete Order
      </Button>
    </form>
  )
}
