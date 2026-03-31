import Link from 'next/link'
import { OrderStatus, PaymentMethod, DiscountType } from '@prisma/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { formatPaymentMethodLabel } from '@/lib/payments/labels'

type OrdersTableProps = {
  eventId: string
  orders: Array<{
    id: string
    orderNumber: string
    buyerFirstName: string
    buyerLastName: string
    buyerEmail: string
    status: OrderStatus
    paymentMethod: PaymentMethod | null
    totalAmount: number
    currency: string
    createdAt: Date
    discountCode?: {
      code: string
      discountType: DiscountType
    } | null
  }>
}

export function OrdersTable({ eventId, orders }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
        No orders found.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Order</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Buyer</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Payment</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/events/${eventId}/orders/${order.id}`} className="font-medium text-[#5C8BD9] hover:text-[#4a7ac8]">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {order.buyerFirstName} {order.buyerLastName}
                  <p className="text-xs text-gray-500">{order.buyerEmail}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{order.status}</td>
                <td className="px-4 py-3 text-gray-700">
                  {order.paymentMethod === 'INVOICE' ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Invoice</span>
                  ) : (
                    formatPaymentMethodLabel(order.paymentMethod)
                  )}
                  {order.discountCode && (
                    <p className="text-xs text-gray-500">
                      Code: {order.discountCode.code}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-900">{formatCurrency(order.totalAmount, order.currency)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
