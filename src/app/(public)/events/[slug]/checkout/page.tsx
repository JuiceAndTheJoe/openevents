import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CheckoutForm } from '@/components/tickets/CheckoutForm'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { getCheckoutUnavailableNotice, getCheckoutUnavailableReason } from '@/lib/orders/checkoutAvailability'

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
      coverImage: true,
      status: true,
      ticketTypes: {
        where: { isVisible: true },
        select: {
          salesStartDate: true,
          salesEndDate: true,
          maxCapacity: true,
          soldCount: true,
          reservedCount: true,
          isVisible: true,
        },
      },
      groupDiscounts: {
        where: { isActive: true },
        select: {
          id: true,
          ticketTypeId: true,
          minQuantity: true,
          discountType: true,
          discountValue: true,
        },
        orderBy: { minQuantity: 'asc' },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const checkoutUnavailableReason = getCheckoutUnavailableReason(event)
  if (checkoutUnavailableReason) {
    const notice = getCheckoutUnavailableNotice(checkoutUnavailableReason)
    redirect(`/events/${event.slug}?notice=${encodeURIComponent(notice)}`)
  }

  const location =
    event.locationType === 'ONLINE'
      ? event.onlineUrl || 'Online event'
      : [event.venue, event.city, event.country].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-row items-stretch justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <p className="font-bold text-base text-black leading-tight">{event.title}</p>
            <p className="text-sm text-gray-700 leading-snug">{location}</p>
            <p className="text-sm text-gray-700">
              {formatDateTime(event.startDate, { timeZoneName: 'short' })}
            </p>
          </div>
          <div className="w-44 aspect-video rounded-[10px] overflow-hidden flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600">
            {event.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/events/${encodeURIComponent(event.slug)}/image?slot=cover`}
                alt={event.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <CheckoutForm
        event={{
          id: event.id,
          slug: event.slug,
          title: event.title,
          country: event.country,
        }}
        groupDiscounts={event.groupDiscounts.map((gd) => ({
          id: gd.id,
          ticketTypeId: gd.ticketTypeId,
          minQuantity: gd.minQuantity,
          discountType: gd.discountType,
          discountValue: Number(gd.discountValue),
        }))}
      />
    </div>
  )
}
