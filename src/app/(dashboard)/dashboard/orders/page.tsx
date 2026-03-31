import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { OrderList, type DashboardOrderListItem } from '@/components/dashboard/OrderList'
import { isCancellationDeadlinePassed } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardOrdersPage() {
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
          coverImage: true,
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

  const mappedOrders: DashboardOrderListItem[] = orders.map((order) => {
    const canCancelByStatus = order.status === 'PENDING' || order.status === 'PENDING_INVOICE' || order.status === 'PAID'
    const beforeDeadline = !isCancellationDeadlinePassed(
      order.event.startDate,
      order.event.cancellationDeadlineHours
    )

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt.toISOString(),
      totalAmount: Number(order.totalAmount.toString()),
      currency: order.currency,
      buyerEmail: order.buyerEmail,
      event: {
        title: order.event.title,
        slug: order.event.slug,
        startDate: order.event.startDate.toISOString(),
        coverImage: order.event.coverImage,
      },
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice.toString()),
        totalPrice: Number(item.totalPrice.toString()),
        ticketType: {
          name: item.ticketType.name,
        },
      })),
      canCancel: canCancelByStatus && beforeDeadline,
    }
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-600">View orders, check ticket details, and cancel when eligible.</p>
      </div>

      <OrderList orders={mappedOrders} />
    </div>
  )
}
