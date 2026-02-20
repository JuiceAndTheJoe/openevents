import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { OrderList } from '@/components/dashboard/OrderList'
import { isCancellationDeadlinePassed } from '@/lib/utils'

export default async function MyTicketsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id,
    },
    include: {
      event: {
        select: {
          title: true,
          slug: true,
          startDate: true,
          cancellationDeadlineHours: true,
        },
      },
      items: {
        include: {
          ticketType: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const mappedOrders = orders.map((order) => {
    const canCancelByStatus =
      order.status === 'PENDING' || order.status === 'PENDING_INVOICE' || order.status === 'PAID'
    const beforeDeadline = !isCancellationDeadlinePassed(
      order.event.startDate,
      order.event.cancellationDeadlineHours
    )

    return {
      ...order,
      canCancel: canCancelByStatus && beforeDeadline,
    }
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
        <p className="text-sm text-gray-600">View your ticket orders and event confirmations.</p>
      </div>

      <OrderList orders={mappedOrders} />
    </div>
  )
}
