'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type DashboardOrderDetails } from '@/components/dashboard/OrderDetails'

export interface DashboardOrderListItem extends DashboardOrderDetails {
  event: {
    title: string
    slug: string
    startDate: string
    coverImage: string | null
  }
  canCancel: boolean
}

interface OrderListProps {
  orders: DashboardOrderListItem[]
}

export function OrderList({ orders }: OrderListProps) {
  const router = useRouter()
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
        const confirmationHref = `/orders/${order.orderNumber}`

        return (
          <div
            key={order.id}
            role="link"
            tabIndex={0}
            onClick={() => router.push(confirmationHref)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                router.push(confirmationHref)
              }
            }}
            className="cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C8BD9] focus-visible:ring-offset-2"
            aria-label={`View tickets for ${order.event.title}`}
          >
            <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
              <div className="h-44 w-full bg-gradient-to-r from-[#5C8BD9] to-indigo-600">
                {order.event.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/events/${encodeURIComponent(order.event.slug)}/image?slot=cover`}
                    alt={order.event.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{order.event.title}</CardTitle>
                <p className="text-sm text-gray-600">{`Order #${order.orderNumber}`}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-700">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-gray-900">Status:</span> {order.status}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Event Date:</span>{' '}
                    {new Date(order.event.startDate).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Total:</span> {order.totalAmount} {order.currency}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/events/${order.event.slug}`} onClick={(event) => event.stopPropagation()}>
                    <Button type="button" variant="outline" size="sm">
                      View Event
                    </Button>
                  </Link>

                  {order.canCancel && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleCancel(order.id)
                      }}
                      isLoading={actionOrderId === order.id}
                    >
                      Cancel Order
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
