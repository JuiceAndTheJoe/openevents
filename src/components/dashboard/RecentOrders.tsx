import Link from 'next/link'
import { OrderStatus } from '@prisma/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type RecentOrdersProps = {
  orders: Array<{
    id: string
    orderNumber: string
    status: OrderStatus
    totalAmount: number
    currency: string
    buyerEmail: string
    createdAt: Date
    event: {
      id: string
      title: string
    }
  }>
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-600">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/dashboard/events/${order.event.id}/orders/${order.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                  {order.orderNumber}
                </Link>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount, order.currency)}</p>
              </div>
              <p className="text-sm text-gray-600">{order.event.title}</p>
              <p className="text-xs text-gray-500">{order.buyerEmail} · {order.status} · {formatDateTime(order.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
