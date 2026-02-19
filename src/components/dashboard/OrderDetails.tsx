import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface DashboardOrderDetails {
  id: string
  orderNumber: string
  status: string
  paymentMethod: string | null
  createdAt: Date
  totalAmount: { toString(): string } | string
  currency: string
  buyerEmail: string
  items: Array<{
    id: string
    quantity: number
    unitPrice: { toString(): string } | string
    totalPrice: { toString(): string } | string
    ticketType: {
      name: string
    }
  }>
}

interface OrderDetailsProps {
  order: DashboardOrderDetails
}

export function OrderDetails({ order }: OrderDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Order #{order.orderNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="font-medium text-gray-900">Status:</span> {order.status}
          </p>
          <p>
            <span className="font-medium text-gray-900">Payment:</span> {order.paymentMethod || 'N/A'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Buyer Email:</span> {order.buyerEmail}
          </p>
          <p>
            <span className="font-medium text-gray-900">Total:</span> {order.totalAmount.toString()}{' '}
            {order.currency}
          </p>
        </div>

        <div>
          <p className="mb-2 font-medium text-gray-900">Tickets</p>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-md border border-gray-200 p-2">
                <p className="font-medium text-gray-900">{item.ticketType.name}</p>
                <p className="text-gray-600">
                  {item.quantity} x {item.unitPrice.toString()} = {item.totalPrice.toString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
