import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { DownloadTicketsButton } from '@/components/tickets/DownloadTicketsButton'

interface TicketDisplayProps {
  order: {
    orderNumber: string
    status: string
    buyerFirstName: string
    buyerLastName: string
    buyerEmail: string
    totalAmount: { toString(): string } | string
    currency: string
    event: {
      title: string
      slug: string
      startDate: Date
      endDate: Date
      locationType: string
      venue: string | null
      city: string | null
      country: string | null
      onlineUrl: string | null
    }
    tickets: Array<{
      id: string
      ticketCode: string
      status: string
      attendeeFirstName: string | null
      attendeeLastName: string | null
      attendeeEmail: string | null
      ticketTypeId: string
    }>
    items: Array<{
      id: string
      quantity: number
      ticketType: {
        name: string
      }
    }>
  }
}

export function TicketDisplay({ order }: TicketDisplayProps) {
  const eventLocation =
    order.event.locationType === 'ONLINE'
      ? order.event.onlineUrl || 'Online event'
      : [order.event.venue, order.event.city, order.event.country].filter(Boolean).join(', ')

  const calendarStart = new Date(order.event.startDate).toISOString().replace(/[-:]|\.\d{3}/g, '')
  const calendarEnd = new Date(order.event.endDate).toISOString().replace(/[-:]|\.\d{3}/g, '')
  const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(order.event.title)}&dates=${calendarStart}/${calendarEnd}&location=${encodeURIComponent(eventLocation)}`

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Order #{order.orderNumber}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-gray-900">Status:</span> {order.status}
          </p>
          <p>
            <span className="font-medium text-gray-900">Buyer:</span> {order.buyerFirstName} {order.buyerLastName} ({order.buyerEmail})
          </p>
          <p>
            <span className="font-medium text-gray-900">Event:</span> {order.event.title}
          </p>
          <p>
            <span className="font-medium text-gray-900">Date:</span> {formatDateTime(order.event.startDate)}
          </p>
          <p>
            <span className="font-medium text-gray-900">Location:</span> {eventLocation}
          </p>
          <p>
            <span className="font-medium text-gray-900">Total:</span> {order.totalAmount.toString()}{' '}
            {order.currency}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <a
              href={calendarUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Add to Calendar
            </a>
            <DownloadTicketsButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {order.tickets.length === 0 ? (
            <p className="text-sm text-gray-500">
              Tickets have not been issued yet. This can happen for pending invoice orders.
            </p>
          ) : (
            <div className="grid gap-3">
              {order.tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-md border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">Ticket Code: {ticket.ticketCode}</p>
                  <p className="text-xs text-gray-500">Status: {ticket.status}</p>
                  <p className="mt-2 text-xs text-gray-500">QR: [stub] {ticket.ticketCode}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
