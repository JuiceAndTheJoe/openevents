import Link from 'next/link'
import { revalidatePath, revalidateTag } from 'next/cache'
import { notFound } from 'next/navigation'
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause, canAccessEvent } from '@/lib/dashboard/organizer'
import { OrderFilters } from '@/components/dashboard/OrderFilters'
import { OrdersTable } from '@/components/dashboard/OrdersTable'
import { BulkActionForm } from '@/components/dashboard/BulkActionForm'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function EventOrdersPage({ params, searchParams }: PageProps) {
  await requireOrganizerProfile()
  const { id } = await params
  const qs = await searchParams

  const search = readParam(qs.search)
  const status = readParam(qs.status) as OrderStatus | undefined
  const paymentMethod = readParam(qs.paymentMethod) as PaymentMethod | undefined
  const dateFrom = readParam(qs.dateFrom)
  const dateTo = readParam(qs.dateTo)

  const eventWhere = buildEventWhereClause(null, true, { id })

  const event = await prisma.event.findFirst({
    where: eventWhere,
    select: {
      id: true,
      title: true,
      ticketTypes: {
        where: { isVisible: true },
        select: {
          name: true,
          soldCount: true,
          reservedCount: true,
          maxCapacity: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const orderWhere: Prisma.OrderWhereInput = {
    eventId: id,
  }

  if (status && ['PENDING', 'PENDING_INVOICE', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)) {
    orderWhere.status = status
  }

  if (paymentMethod && ['PAYPAL', 'INVOICE', 'FREE'].includes(paymentMethod)) {
    orderWhere.paymentMethod = paymentMethod
  }

  if (search) {
    orderWhere.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { buyerEmail: { contains: search, mode: 'insensitive' } },
      { buyerFirstName: { contains: search, mode: 'insensitive' } },
      { buyerLastName: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (dateFrom || dateTo) {
    orderWhere.createdAt = {
      gte: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined,
      lte: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined,
    }
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      orderNumber: true,
      buyerFirstName: true,
      buyerLastName: true,
      buyerEmail: true,
      status: true,
      paymentMethod: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      discountCode: {
        select: {
          code: true,
          discountType: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  async function applyBulkAction(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) return

    const action = String(formData.get('bulkAction') || '')

    if (action === 'cancel_all_filtered') {
      await prisma.order.updateMany({
        where: {
          eventId: id,
          event: { id, deletedAt: null },
          status: {
            in: ['PENDING', 'PENDING_INVOICE'],
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })
    } else if (action === 'delete_all_filtered') {
      const ordersToDelete = await prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          status: true,
          items: { select: { ticketTypeId: true, quantity: true } },
        },
      })

      await prisma.$transaction(async (tx) => {
        for (const order of ordersToDelete) {
          for (const item of order.items) {
            if (order.status === 'PAID') {
              await tx.ticketType.update({
                where: { id: item.ticketTypeId },
                data: { soldCount: { decrement: item.quantity } },
              })
            } else if (order.status === 'PENDING' || order.status === 'PENDING_INVOICE') {
              await tx.ticketType.update({
                where: { id: item.ticketTypeId },
                data: { reservedCount: { decrement: item.quantity } },
              })
            }
          }
        }

        await tx.order.deleteMany({
          where: { id: { in: ordersToDelete.map((o) => o.id) } },
        })
      })

      revalidateTag('event-analytics', 'max')
      revalidateTag('dashboard-analytics', 'max')
    } else {
      return
    }

    revalidatePath(`/dashboard/events/${id}/orders`)
  }

  const exportParams = new URLSearchParams()
  if (search) exportParams.set('search', search)
  if (status) exportParams.set('status', status)
  if (paymentMethod) exportParams.set('paymentMethod', paymentMethod)
  if (dateFrom) exportParams.set('dateFrom', dateFrom)
  if (dateTo) exportParams.set('dateTo', dateTo)

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/events" className="hover:text-gray-700">Events</Link>
        <span>/</span>
        <Link href={`/dashboard/events/${id}`} className="hover:text-gray-700">{event.title}</Link>
        <span>/</span>
        <span className="text-gray-900">Orders</span>
      </nav>

      {/* Ticket stats */}
      {event.ticketTypes.length > 0 && (() => {
        const totalSold = event.ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0)
        const totalCapacity = event.ticketTypes.every(tt => tt.maxCapacity !== null)
          ? event.ticketTypes.reduce((sum, tt) => sum + (tt.maxCapacity ?? 0), 0)
          : null
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Tickets Sold</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {totalSold}{totalCapacity !== null ? ` / ${totalCapacity}` : ''}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Orders</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{orders.length}</p>
            </div>
            {event.ticketTypes.map((tt) => (
              <div key={tt.name} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">{tt.name}</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">
                  {tt.soldCount}{tt.maxCapacity !== null ? ` / ${tt.maxCapacity}` : ''}
                  <span className="ml-1 text-sm font-normal text-gray-500">sold</span>
                </p>
                {tt.reservedCount > 0 && (
                  <p className="text-xs text-amber-600">{tt.reservedCount} reserved</p>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Order management for {event.title}.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/events/${id}/orders/new`}
            className="inline-flex rounded-md bg-[#5C8BD9] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a7ac8]"
          >
            Create Manual Order
          </Link>
          <Link
            href={`/api/dashboard/events/${id}/orders/export?${exportParams.toString()}`}
            className="inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            Export CSV
          </Link>
        </div>
      </div>

      <OrderFilters initial={{ search, status: status || '', paymentMethod: paymentMethod || '', dateFrom, dateTo }} />

      <BulkActionForm action={applyBulkAction} orderCount={orders.length} />

      <OrdersTable
        eventId={event.id}
        orders={orders.map((order) => ({
          ...order,
          totalAmount: Number(order.totalAmount.toString()),
          discountCode: order.discountCode ? {
            code: order.discountCode.code,
            discountType: order.discountCode.discountType,
          } : null,
        }))}
      />
    </div>
  )
}
