'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderDetails, type DashboardOrderDetails } from '@/components/dashboard/OrderDetails'

export interface DashboardOrderListItem extends DashboardOrderDetails {
  event: {
    title: string
    slug: string
    startDate: Date
  }
  canCancel: boolean
}

interface OrderListProps {
  orders: DashboardOrderListItem[]
}

export function OrderList({ orders }: OrderListProps) {
  const router = useRouter()
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [actionOrderId, setActionOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel(orderId: string) {
    setActionOrderId(orderId)
    setError(null)

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelled by user from dashboard' }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to cancel order')
        return
      }

      router.refresh()
    } catch (cancelError) {
      console.error('Failed to cancel order', cancelError)
      setError('Failed to cancel order')
    } finally {
      setActionOrderId(null)
    }
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <p className="text-sm text-gray-500">You have not purchased any tickets yet.</p>
            <Link href="/events">
              <Button variant="outline" size="sm">Browse events</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.id

        return (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                #{order.orderNumber} · {order.event.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-gray-900">Status:</span> {order.status}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Event Date:</span>{' '}
                  {new Date(order.event.startDate).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  {isExpanded ? 'Hide Details' : 'View Details'}
                </Button>

                <Link href={`/orders/${order.orderNumber}/confirmation`}>
                  <Button type="button" variant="outline" size="sm">
                    View Tickets
                  </Button>
                </Link>

                {order.canCancel && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(order.id)}
                    isLoading={actionOrderId === order.id}
                  >
                    Cancel Order
                  </Button>
                )}
              </div>

              {isExpanded && <OrderDetails order={order} />}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
