import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause, canAccessEvent } from '@/lib/dashboard/organizer'
import { OrderFilters } from '@/components/dashboard/OrderFilters'
import { OrdersTable } from '@/components/dashboard/OrdersTable'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function EventOrdersPage({ params, searchParams }: PageProps) {
  const { organizerProfile, isSuperAdmin } = await requireOrganizerProfile()
  const { id } = await params
  const qs = await searchParams

  const search = readParam(qs.search)
  const status = readParam(qs.status) as OrderStatus | undefined
  const paymentMethod = readParam(qs.paymentMethod) as PaymentMethod | undefined
  const dateFrom = readParam(qs.dateFrom)
  const dateTo = readParam(qs.dateTo)

  const eventWhere = buildEventWhereClause(organizerProfile, isSuperAdmin, { id })

  const event = await prisma.event.findFirst({
    where: eventWhere,
    select: {
      id: true,
      title: true,
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
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  async function applyBulkAction(formData: FormData) {
    'use server'

    const { event: eventCheck, isSuperAdmin, organizerProfile } = await canAccessEvent(id)
    if (!eventCheck) return

    const action = String(formData.get('bulkAction') || '')

    if (action !== 'cancel_all_filtered') return

    const eventWhere: Prisma.EventWhereInput = isSuperAdmin
      ? { id, deletedAt: null }
      : { id, organizerId: organizerProfile!.id, deletedAt: null }

    await prisma.order.updateMany({
      where: {
        eventId: id,
        event: eventWhere,
        status: {
          in: ['PENDING', 'PENDING_INVOICE'],
        },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    })

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">Order management for {event.title}.</p>
        </div>
        <Link
          href={`/api/dashboard/events/${id}/orders/export?${exportParams.toString()}`}
          className="inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          Export CSV
        </Link>
      </div>

      <OrderFilters initial={{ search, status: status || '', paymentMethod: paymentMethod || '', dateFrom, dateTo }} />

      <form action={applyBulkAction} className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <select name="bulkAction" className="h-10 rounded-md border border-gray-300 px-3 text-sm">
            <option value="">Bulk actions</option>
            <option value="cancel_all_filtered">Cancel all pending orders</option>
          </select>
          <button type="submit" className="h-10 rounded-md bg-[#5C8BD9] px-4 text-sm font-medium text-white">Apply</button>
        </div>
      </form>

      <OrdersTable
        eventId={event.id}
        orders={orders.map((order) => ({
          ...order,
          totalAmount: Number(order.totalAmount.toString()),
        }))}
      />
    </div>
  )
}
