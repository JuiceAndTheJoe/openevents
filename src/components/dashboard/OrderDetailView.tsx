'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { formatPaymentMethodLabel } from '@/lib/payments/labels'
import { getPendingOrderLabel } from '@/lib/orders/pendingLabel'
import { getIncludedVatFromVatInclusiveTotal } from '@/lib/pricing/vat'
import { useToast } from '@/components/ui/toaster'

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
    vatRate: number
    vatAmount: number
    currency: string
    createdAt: Date
    invoiceSentAt?: Date | null
    reminderSentAt?: Date | null
    discountCode?: string | null
    discountLabel?: string | null
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
  sendReminderAction?: (formData: FormData) => Promise<void>
  deleteOrderAction?: (formData: FormData) => Promise<void>
}

export function OrderDetailView({ order, refundAction, emailAction, markPaidAction, markInvoiceSentAction, sendReminderAction, deleteOrderAction }: OrderDetailViewProps) {
  const isPendingInvoice = order.status === 'PENDING_INVOICE'
  const showMarkInvoiceSent = isPendingInvoice && !order.invoiceSentAt && markInvoiceSentAction
  const pendingLabel = getPendingOrderLabel(order)
  const pendingLabelIsReminder = order.reminderSentAt != null

  // Stored subtotal/discount/unitPrice/totalPrice are VAT-inclusive (see
  // src/lib/orders/index.ts:prepareOrderItems). Convert back to ex-VAT so
  // organizers feeding an external invoicing tool (Fortnox etc.) don't
  // accidentally treat the gross total as a net base and get double VAT.
  const hasVat = order.vatRate > 0
  const toExVat = (vatInclusive: number): number => {
    if (!hasVat) return vatInclusive
    return Number(
      (vatInclusive - getIncludedVatFromVatInclusiveTotal(vatInclusive, order.vatRate)).toFixed(2)
    )
  }
  const subtotalExVat = toExVat(order.subtotal)
  const discountExVat = toExVat(order.discountAmount)
  const vatPercent = hasVat ? Math.round(order.vatRate * 100) : 0
  const discountRowLabel = order.discountLabel
    ? `Discount (${order.discountLabel})`
    : 'Discount'

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
        {pendingLabel && (
          <p
            className={`mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-center text-sm font-medium ${
              pendingLabelIsReminder
                ? 'bg-blue-100 text-blue-600'
                : 'bg-amber-100 text-amber-600'
            }`}
          >
            {pendingLabel}
            {pendingLabelIsReminder && order.reminderSentAt && (
              <span className="ml-1 font-normal">
                on {formatDateTime(order.reminderSentAt)}
              </span>
            )}
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
            <p className="text-sm text-gray-700">
              {hasVat ? 'Subtotal (excl. VAT)' : 'Subtotal'}: {formatCurrency(subtotalExVat, order.currency)}
            </p>
            {order.discountAmount > 0 && (
              <p className="text-sm text-gray-700">
                {discountRowLabel}: -{formatCurrency(discountExVat, order.currency)}
              </p>
            )}
            {hasVat && (
              <p className="text-sm text-gray-700">
                VAT ({vatPercent}%): {formatCurrency(order.vatAmount, order.currency)}
              </p>
            )}
            <p className="text-sm font-semibold text-gray-900">
              {hasVat ? 'Total (incl. VAT)' : 'Total'}: {formatCurrency(order.totalAmount, order.currency)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
        {hasVat && (
          <p className="mt-1 text-xs text-gray-500">Unit and line totals shown excl. VAT.</p>
        )}
        <div className="mt-4 space-y-3">
          {order.items.map((item) => {
            const unitPriceExVat = toExVat(item.unitPrice)
            const lineTotalExVat = toExVat(item.totalPrice)
            return (
              <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                <p className="font-medium text-gray-900">{item.ticketType.name}</p>
                <p className="text-gray-600">Qty {item.quantity} × {formatCurrency(unitPriceExVat, order.currency)} = {formatCurrency(lineTotalExVat, order.currency)}</p>
              </div>
            )
          })}
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
          <SendEmailButton
            orderId={order.id}
            action={emailAction}
            deemphasize={order.status === 'PENDING'}
          />
          {order.status === 'PENDING' && sendReminderAction && (
            <SendReminderButton
              orderId={order.id}
              action={sendReminderAction}
              alreadySent={order.reminderSentAt != null}
              emphasize
            />
          )}
          {deleteOrderAction && (
            <DeleteOrderButton orderId={order.id} action={deleteOrderAction} />
          )}
        </div>
      </section>
    </div>
  )
}

function SendEmailButton({
  orderId,
  action,
  deemphasize = false,
}: {
  orderId: string
  action: (formData: FormData) => Promise<void>
  deemphasize?: boolean
}) {
  const [isSending, setIsSending] = useState(false)
  const showToast = useToast()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSending(true)
    try {
      const formData = new FormData(e.currentTarget)
      await action(formData)
      showToast('Confirmation sent!', 'success')
    } catch {
      showToast('Failed to send confirmation', 'error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant={deemphasize ? 'outline' : 'default'} disabled={isSending}>
        {isSending ? 'Sending…' : 'Resend order confirmation (tickets + receipt)'}
      </Button>
    </form>
  )
}

function SendReminderButton({
  orderId,
  action,
  alreadySent,
  emphasize = false,
}: {
  orderId: string
  action: (formData: FormData) => Promise<void>
  alreadySent: boolean
  emphasize?: boolean
}) {
  const [isSending, setIsSending] = useState(false)
  const showToast = useToast()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (alreadySent && !confirm('A reminder has already been sent for this order. Send another?')) {
      return
    }
    setIsSending(true)
    try {
      const formData = new FormData(e.currentTarget)
      await action(formData)
      showToast('Reminder sent!', 'success')
    } catch {
      showToast('Failed to send reminder', 'error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant={emphasize ? 'default' : 'outline'} disabled={isSending}>
        {isSending
          ? 'Sending…'
          : alreadySent
          ? 'Resend payment reminder'
          : 'Send payment reminder'}
      </Button>
    </form>
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
