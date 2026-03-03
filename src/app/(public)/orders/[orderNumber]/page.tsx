import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TicketDisplay } from '@/components/tickets/TicketDisplay'

interface ConfirmationPageProps {
  params: Promise<{ orderNumber: string }>
}

function getPageTitle(status: string, paymentMethod: string | null): string {
  if (status === 'PENDING_INVOICE') {
    return 'Invoice Order Received'
  }
  if (status === 'PAID') {
    return 'Order Confirmed'
  }
  if (status === 'PENDING' && paymentMethod === 'INVOICE') {
    return 'Invoice Order Received'
  }
  if (status === 'CANCELLED') {
    return 'Order Cancelled'
  }
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return 'Order Refunded'
  }
  return 'Order Details'
}

export default async function OrderConfirmationPage({ params }: ConfirmationPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const { orderNumber } = await params

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      OR: [{ userId: user.id }, { event: { organizer: { userId: user.id } } }],
    },
    include: {
      event: {
        select: {
          title: true,
          slug: true,
          startDate: true,
          endDate: true,
          locationType: true,
          venue: true,
          city: true,
          country: true,
          onlineUrl: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          ticketType: {
            select: {
              name: true,
            },
          },
        },
      },
      tickets: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  if (!order) {
    notFound()
  }

  const pageTitle = getPageTitle(order.status, order.paymentMethod)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{pageTitle}</h1>
      <TicketDisplay order={order} />
    </div>
  )
}
