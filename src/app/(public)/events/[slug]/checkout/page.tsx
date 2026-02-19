import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CheckoutForm } from '@/components/tickets/CheckoutForm'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'

interface CheckoutPageProps {
  params: Promise<{ slug: string }>
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      startDate: true,
      endDate: true,
      locationType: true,
      venue: true,
      city: true,
      country: true,
      onlineUrl: true,
      status: true,
    },
  })

  if (!event) {
    notFound()
  }

  const location =
    event.locationType === 'ONLINE'
      ? event.onlineUrl || 'Online event'
      : [event.venue, event.city, event.country].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        <p className="text-gray-600">{event.title}</p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Starts:</span> {formatDateTime(event.startDate)}
          </p>
          <p>
            <span className="font-medium text-gray-900">Ends:</span> {formatDateTime(event.endDate)}
          </p>
          <p>
            <span className="font-medium text-gray-900">Location:</span> {location}
          </p>
        </CardContent>
      </Card>

      <CheckoutForm
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
        }}
      />
    </div>
  )
}
