import Link from 'next/link'
import { ExternalLink, CreditCard, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { DownloadTicketsButton } from '@/components/tickets/DownloadTicketsButton'
import { TicketQRCode } from '@/components/tickets/TicketQRCode'
import { AddToCalendar } from '@/components/events/AddToCalendar'

interface TicketDisplayProps {
  order: {
    orderNumber: string
    status: string
    buyerFirstName: string
    buyerLastName: string
    buyerEmail: string
    subtotal?: { toString(): string } | string | number
    discountAmount?: { toString(): string } | string | number
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
      unitPrice: { toString(): string } | string | number
      ticketType: {
        name: string
      }
    }>
    vatRate?: { toString(): string } | string | number | null
    vatAmount?: { toString(): string } | string | number | null
    groupDiscount?: {
      minQuantity: number
      discountType: string
      discountValue: { toString(): string } | string | number
    } | null
  }
}

function getStatusDisplay(status: string): { label: string; className: string } {
  switch (status) {
    case 'PAID':
      return { label: 'Paid', className: 'bg-green-100 text-green-800' }
    case 'PENDING_INVOICE':
      return { label: 'Awaiting Payment', className: 'bg-yellow-100 text-yellow-800' }
    case 'PENDING':
      return { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' }
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'bg-red-100 text-red-800' }
    case 'REFUNDED':
      return { label: 'Refunded', className: 'bg-gray-100 text-gray-800' }
    default:
      return { label: status, className: 'bg-gray-100 text-gray-800' }
  }
}

export function TicketDisplay({ order }: TicketDisplayProps) {
  const eventLocation =
    order.event.locationType === 'ONLINE'
      ? order.event.onlineUrl || 'Online event'
      : [order.event.venue, order.event.city, order.event.country].filter(Boolean).join(', ') || 'Location TBD'

  const isPendingInvoice = order.status === 'PENDING_INVOICE'
  const isPaid = order.status === 'PAID'
  const canDownloadTickets = isPaid && order.tickets.length > 0
  const statusDisplay = getStatusDisplay(order.status)

  // Calculate total tickets for summary
  const totalTickets = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Order #{order.orderNumber}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-gray-900">Status:</span>{' '}
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusDisplay.className}`}>
              {statusDisplay.label}
            </span>
          </p>
          <p>
            <span className="font-medium text-gray-900">Buyer:</span> {order.buyerFirstName} {order.buyerLastName}<span className="print:hidden"> ({order.buyerEmail})</span>
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

          {/* Item Breakdown */}
          {order.items.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-gray-200 pt-3">
              {order.items.map((item) => {
                const price = typeof item.unitPrice === 'number'
                  ? item.unitPrice
                  : parseFloat(item.unitPrice.toString())
                return (
                  <p key={item.id} className="text-gray-700">
                    {item.quantity}x {item.ticketType.name} à {price} {order.currency}
                  </p>
                )
              })}
              {(() => {
                const discountAmt = order.discountAmount
                  ? typeof order.discountAmount === 'number'
                    ? order.discountAmount
                    : parseFloat(order.discountAmount.toString())
                  : 0
                const hasDiscount = discountAmt > 0 && order.groupDiscount

                if (hasDiscount) {
                  const discountLabel =
                    order.groupDiscount!.discountType === 'PERCENTAGE'
                      ? `${parseFloat(order.groupDiscount!.discountValue.toString())}%`
                      : `${parseFloat(order.groupDiscount!.discountValue.toString())} ${order.currency}`
                  const subtotal = order.subtotal
                    ? typeof order.subtotal === 'number'
                      ? order.subtotal
                      : parseFloat(order.subtotal.toString())
                    : 0
                  return (
                    <>
                      <p className="mt-2 text-green-700">
                        Group discount ({order.groupDiscount!.minQuantity}+ tickets, {discountLabel} off): −{discountAmt} {order.currency}
                      </p>
                      {subtotal > 0 && (
                        <div className="space-y-0.5">
                          {order.items.map((item) => {
                            const unitPrice = typeof item.unitPrice === 'number'
                              ? item.unitPrice
                              : parseFloat(item.unitPrice.toString())
                            const discountedUnit = unitPrice * (1 - discountAmt / subtotal)
                            return (
                              <p key={item.id} className="text-xs text-green-700">
                                {item.ticketType.name}: {discountedUnit.toFixed(2)} {order.currency} per ticket after discount
                              </p>
                            )
                          })}
                        </div>
                      )}
                      <p className="font-medium text-gray-900">
                        Summary: {totalTickets} tickets, {order.totalAmount.toString()} {order.currency}
                      </p>
                    </>
                  )
                }

                return (
                  <p className="mt-2 font-medium text-gray-900">
                    Summary: {totalTickets} tickets, {order.totalAmount.toString()} {order.currency}
                  </p>
                )
              })()}
              {order.vatRate && parseFloat(order.vatRate.toString()) > 0 && (
                <p className="text-sm text-gray-500">
                  Incl. VAT ({Math.round(parseFloat(order.vatRate.toString()) * 100)}%): {parseFloat((order.vatAmount ?? 0).toString()).toFixed(2)} {order.currency}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-3 print:hidden">
            <Link
              href={`/events/${order.event.slug}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" />
              View Event
            </Link>
            <AddToCalendar
              eventSlug={order.event.slug}
              event={{
                title: order.event.title,
                location: eventLocation,
                startDate: order.event.startDate,
                endDate: order.event.endDate,
              }}
            />
            {canDownloadTickets && <DownloadTicketsButton />}
          </div>
        </CardContent>
      </Card>

      {isPendingInvoice && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-yellow-800">
              <CreditCard className="h-5 w-5" />
              Payment Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* Status Progression */}
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-yellow-200 bg-white p-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Order Received</span>
              </div>
              <div className="hidden h-0.5 w-4 bg-yellow-300 sm:block" />
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-700">Awaiting Payment</span>
              </div>
              <div className="hidden h-0.5 w-4 bg-gray-200 sm:block" />
              <div className="flex items-center gap-1.5 opacity-50">
                <CheckCircle className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-400">Tickets Issued</span>
              </div>
            </div>

            <div className="space-y-2 text-yellow-800">
              <p>
                Your order has been received. Please complete payment to receive your tickets.
              </p>
              <p className="font-medium">
                What happens next:
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-sm">
                <li>Pay the invoice using the details below</li>
                <li>The organizer confirms your payment</li>
                <li>Your tickets will be issued and available for download</li>
              </ol>
            </div>

            <div className="rounded-md border border-yellow-200 bg-white p-4">
              <h4 className="mb-2 font-semibold text-gray-900">Payment Details</h4>
              <dl className="space-y-1 text-gray-700">
                <div className="flex justify-between">
                  <dt>Reference:</dt>
                  <dd className="font-mono font-medium">{order.orderNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Amount:</dt>
                  <dd className="font-medium">{order.totalAmount.toString()} {order.currency}</dd>
                </div>
                {order.vatRate && parseFloat(order.vatRate.toString()) > 0 && (
                  <div className="flex justify-between">
                    <dt>VAT ({Math.round(parseFloat(order.vatRate.toString()) * 100)}%):</dt>
                    <dd className="font-medium">{parseFloat((order.vatAmount ?? 0).toString()).toFixed(2)} {order.currency}</dd>
                  </div>
                )}
              </dl>
            </div>
            <p className="text-xs text-yellow-700">
              Please include your order number ({order.orderNumber}) as the payment reference.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your tickets - present the QR code(s) below at the door</CardTitle>
        </CardHeader>
        <CardContent>
          {order.tickets.length === 0 ? (
            <div className="text-sm text-gray-500">
              {isPendingInvoice ? (
                <p>
                  Your tickets will be issued once your invoice payment has been received and confirmed by the event organizer.
                </p>
              ) : (
                <p>Tickets have not been issued yet.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {order.tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-md border border-gray-200 p-4">
                  <div className="flex items-start gap-4">
                    <TicketQRCode ticketCode={ticket.ticketCode} size={80} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{ticket.ticketCode}</p>
                      <p className="text-xs text-gray-500">Status: {ticket.status}</p>
                      {ticket.attendeeFirstName && (
                        <p className="mt-1 text-xs text-gray-600">
                          {ticket.attendeeFirstName} {ticket.attendeeLastName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
