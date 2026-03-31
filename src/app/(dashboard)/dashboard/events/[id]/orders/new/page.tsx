import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause } from '@/lib/dashboard/organizer'
import { ManualOrderForm } from '@/components/dashboard/ManualOrderForm'
import { getPriceIncludingVat } from '@/lib/pricing/vat'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function NewManualOrderPage({ params }: PageProps) {
  await requireOrganizerProfile()
  const { id } = await params

  const eventWhere = buildEventWhereClause(null, true, { id })

  const event = await prisma.event.findFirst({
    where: eventWhere,
    select: {
      id: true,
      title: true,
      ticketTypes: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          minPerOrder: true,
          maxPerOrder: true,
          maxCapacity: true,
          soldCount: true,
          reservedCount: true,
          salesStartDate: true,
          salesEndDate: true,
          isVisible: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
      groupDiscounts: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          ticketTypeId: true,
          minQuantity: true,
          discountType: true,
          discountValue: true,
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  // Transform ticket types for the form
  const ticketTypes = event.ticketTypes.map((ticketType) => {
    const remaining =
      ticketType.maxCapacity !== null
        ? ticketType.maxCapacity - ticketType.soldCount - ticketType.reservedCount
        : null

    // For manual orders, always mark as available (organizer can override availability)
    const isAvailable = remaining === null || remaining > 0

    return {
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      price: getPriceIncludingVat(Number(ticketType.price)),
      currency: ticketType.currency,
      minPerOrder: ticketType.minPerOrder,
      maxPerOrder: ticketType.maxPerOrder,
      remaining,
      sold: ticketType.soldCount,
      isAvailable,
    }
  })

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/dashboard/events" className="hover:text-gray-700">
          Events
        </Link>
        <span>/</span>
        <Link href={`/dashboard/events/${id}`} className="hover:text-gray-700">
          {event.title}
        </Link>
        <span>/</span>
        <Link href={`/dashboard/events/${id}/orders`} className="hover:text-gray-700">
          Orders
        </Link>
        <span>/</span>
        <span className="text-gray-900">New Manual Order</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Manual Order</h1>
        <p className="text-gray-600">
          Create a new invoice order for {event.title}. This is for B2B customers who will pay by invoice.
        </p>
      </div>

      <ManualOrderForm
        event={{ id: event.id, title: event.title }}
        ticketTypes={ticketTypes}
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
