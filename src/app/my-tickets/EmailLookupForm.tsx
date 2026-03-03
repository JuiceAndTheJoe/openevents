'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface TicketData {
  id: string
  ticketCode: string
  status: string
  attendeeFirstName: string | null
  attendeeLastName: string | null
  attendeeEmail: string | null
  ticketType: string
  order: {
    orderNumber: string
    status: string
    createdAt: string
    totalAmount: number
    currency: string
    event: {
      title: string
      slug: string
      startDate: string
      coverImage: string | null
    }
  }
}

export function EmailLookupForm() {
  const [email, setEmail] = useState('')
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setHasSearched(false)

    try {
      const response = await fetch('/api/tickets/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to lookup tickets')
        setTickets([])
        setHasSearched(true)
        return
      }

      setTickets(data.tickets)
      setHasSearched(true)
    } catch (lookupError) {
      console.error('Failed to lookup tickets', lookupError)
      setError('Failed to lookup tickets. Please try again.')
      setTickets([])
      setHasSearched(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email to view your tickets"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                error={error || undefined}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" isLoading={isLoading} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'View My Tickets'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {hasSearched && tickets.length === 0 && !error && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">
              No tickets found for this email address. Please check your email or contact support if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      )}

      {tickets.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Found {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} for {email}
          </p>
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <div className="h-44 w-full bg-gradient-to-r from-[#5C8BD9] to-indigo-600">
                {ticket.order.event.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/events/${encodeURIComponent(ticket.order.event.slug)}/image?slot=cover`}
                    alt={ticket.order.event.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <CardContent className="space-y-3 p-6">
                <div>
                  <h3 className="text-xl font-semibold">{ticket.order.event.title}</h3>
                  <p className="text-sm text-gray-600">Order #{ticket.order.orderNumber}</p>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium text-gray-900">Ticket Code:</span> {ticket.ticketCode}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Ticket Type:</span> {ticket.ticketType}
                  </p>
                  {ticket.attendeeFirstName && ticket.attendeeLastName && (
                    <p>
                      <span className="font-medium text-gray-900">Attendee:</span>{' '}
                      {ticket.attendeeFirstName} {ticket.attendeeLastName}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-gray-900">Status:</span> {ticket.status}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Event Date:</span>{' '}
                    {new Date(ticket.order.event.startDate).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Order Status:</span> {ticket.order.status}
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href={`/orders/${ticket.order.orderNumber}`}
                    className="text-sm text-[#5C8BD9] hover:underline"
                  >
                    View full order details
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
