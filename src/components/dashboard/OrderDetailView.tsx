import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateTime } from '@/lib/utils'

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
}

export function OrderDetailView({ order, refundAction, emailAction }: OrderDetailViewProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-gray-900">Order {order.orderNumber}</h1>
        <p className="mt-1 text-sm text-gray-600">{order.status} · {order.paymentMethod || 'No payment method'} · {formatDateTime(order.createdAt)}</p>

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
          <form action={refundAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button variant="outline" type="submit">Mark Refund Pending</Button>
          </form>
          <form action={emailAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button type="submit">Send Email to Buyer</Button>
          </form>
        </div>
      </section>
    </div>
  )
}
