import Link from 'next/link'
import { revalidatePath, revalidateTag } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { Prisma, PaymentMethod } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { requireOrganizerProfile, canAccessEvent } from '@/lib/dashboard/organizer'
import { OrderDetailView } from '@/components/dashboard/OrderDetailView'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string; orderId: string }>
}

export default async function EventOrderDetailPage({ params }: PageProps) {
  await requireOrganizerProfile()
  const { id, orderId } = await params

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      eventId: id,
      event: { id, deletedAt: null },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      buyerFirstName: true,
      buyerLastName: true,
      buyerEmail: true,
      subtotal: true,
      discountAmount: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      invoiceSentAt: true,
      discountCode: {
        select: {
          code: true,
        },
      },
      event: {
        select: {
          title: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          ticketType: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    notFound()
  }

  async function refundAction(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: { id, deletedAt: null },
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!targetOrder) {
      throw new Error('Order not found')
    }

    await prisma.order.update({
      where: { id: targetOrder.id },
      data: {
        refundStatus: 'PENDING',
        refundReason: 'Manual organizer refund request',
        refundNotes: `Marked pending from dashboard on ${new Date().toISOString()}`,
      },
    })

    revalidatePath(`/dashboard/events/${id}/orders/${submittedOrderId}`)
  }

  async function emailAction(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: { id, deletedAt: null },
      },
      include: {
        items: {
          include: {
            ticketType: {
              select: { name: true },
            },
          },
        },
        tickets: true,
        event: {
          select: {
            title: true,
            startDate: true,
            endDate: true,
            venue: true,
            city: true,
            country: true,
            onlineUrl: true,
          },
        },
      },
    })

    if (!targetOrder) {
      throw new Error('Order not found')
    }

    await sendOrderConfirmationEmail(targetOrder.buyerEmail, {
      orderNumber: targetOrder.orderNumber,
      orderId: targetOrder.id,
      eventTitle: targetOrder.event.title,
      eventDate: targetOrder.event.startDate.toISOString(),
      eventLocation:
        [targetOrder.event.venue, targetOrder.event.city, targetOrder.event.country].filter(Boolean).join(', ') ||
        targetOrder.event.onlineUrl ||
        'TBD',
      tickets: targetOrder.items.map((item) => ({
        name: item.ticketType.name,
        quantity: item.quantity,
        price: `${item.totalPrice.toString()} ${targetOrder.currency}`,
      })),
      totalAmount: `${targetOrder.currency} ${targetOrder.totalAmount.toString()}`,
      buyerName: `${targetOrder.buyerFirstName} ${targetOrder.buyerLastName}`.trim(),
      vatRate: parseFloat(targetOrder.vatRate.toString()),
      vatAmount: targetOrder.vatAmount.toString(),
      ticketCodes: (targetOrder as typeof targetOrder & { tickets: Array<{ ticketCode: string }> }).tickets.map((t) => t.ticketCode),
    })

    revalidatePath(`/dashboard/events/${id}/orders/${submittedOrderId}`)
  }

  async function markPaidAction(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: { id, deletedAt: null },
      },
      include: {
        items: {
          include: {
            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        event: {
          select: {
            title: true,
            startDate: true,
            locationType: true,
            venue: true,
            city: true,
            country: true,
            onlineUrl: true,
          },
        },
      },
    })

    if (!targetOrder) {
      throw new Error('Order not found')
    }

    if (targetOrder.status !== 'PENDING_INVOICE') {
      throw new Error(`Only pending invoice orders can be marked as paid. Current status: ${targetOrder.status}`)
    }

    const ticketTypeIds = Array.from(new Set(targetOrder.items.map((item) => item.ticketTypeId)))

    const paidOrder = await prisma.$transaction(
      async (tx) => {
        await lockTicketTypes(tx, ticketTypeIds)

        const latestOrder = await tx.order.findUniqueOrThrow({
          where: { id: targetOrder.id },
          include: {
            items: {
              include: {
                ticketType: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            event: {
              select: {
                title: true,
                startDate: true,
                locationType: true,
                venue: true,
                city: true,
                country: true,
                onlineUrl: true,
              },
            },
          },
        })

        if (latestOrder.status === 'PAID') {
          return latestOrder
        }

        if (latestOrder.status !== 'PENDING_INVOICE') {
          throw new Error(`Order cannot be marked as paid in status ${latestOrder.status}`)
        }

        // Update ticket counts
        for (const item of latestOrder.items) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              reservedCount: { decrement: item.quantity },
              soldCount: { increment: item.quantity },
            },
          })
        }

        // Mark order as paid
        await tx.order.update({
          where: { id: latestOrder.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentMethod: PaymentMethod.INVOICE,
          },
        })

        // Generate tickets
        const ticketCreateData = generateTicketCreateInput(
          latestOrder.id,
          latestOrder.items.map((item) => ({
            ticketTypeId: item.ticketTypeId,
            ticketTypeName: item.ticketType.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            currency: latestOrder.currency,
            attendees: Array.isArray(item.attendeeData)
              ? (item.attendeeData as unknown as import('@/lib/orders').AttendeeData[])
              : undefined,
          }))
        )

        if (ticketCreateData.length > 0) {
          await tx.ticket.createMany({ data: ticketCreateData })
        }

        return tx.order.findUniqueOrThrow({
          where: { id: latestOrder.id },
          include: {
            items: {
              include: {
                ticketType: { select: { name: true } },
              },
            },
            tickets: true,
            event: {
              select: {
                title: true,
                startDate: true,
                locationType: true,
                venue: true,
                city: true,
                country: true,
                onlineUrl: true,
              },
            },
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    // Send confirmation email
    await sendOrderConfirmationEmail(paidOrder.buyerEmail, {
      orderNumber: paidOrder.orderNumber,
      orderId: paidOrder.id,
      eventTitle: paidOrder.event.title,
      eventDate: formatDateTime(paidOrder.event.startDate),
      eventLocation:
        paidOrder.event.locationType === 'ONLINE'
          ? paidOrder.event.onlineUrl || 'Online event'
          : [paidOrder.event.venue, paidOrder.event.city, paidOrder.event.country].filter(Boolean).join(', '),
      tickets: paidOrder.items.map((item) => ({
        name: item.ticketType.name,
        quantity: item.quantity,
        price: `${item.totalPrice.toString()} ${paidOrder.currency}`,
      })),
      totalAmount: `${paidOrder.totalAmount.toString()} ${paidOrder.currency}`,
      buyerName: `${paidOrder.buyerFirstName} ${paidOrder.buyerLastName}`,
      vatRate: parseFloat(paidOrder.vatRate.toString()),
      vatAmount: paidOrder.vatAmount.toString(),
      ticketCodes: (paidOrder as typeof paidOrder & { tickets: Array<{ ticketCode: string }> }).tickets.map((t) => t.ticketCode),
    })

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')
    revalidatePath(`/dashboard/events/${id}/orders/${submittedOrderId}`)
    revalidatePath(`/dashboard/events/${id}/orders`)
  }

  async function markInvoiceSentAction(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: { id, deletedAt: null },
      },
      select: {
        id: true,
        status: true,
        invoiceSentAt: true,
      },
    })

    if (!targetOrder) {
      throw new Error('Order not found')
    }

    if (targetOrder.status !== 'PENDING_INVOICE') {
      throw new Error(`Only pending invoice orders can have their invoice marked as sent. Current status: ${targetOrder.status}`)
    }

    if (targetOrder.invoiceSentAt) {
      // Already marked as sent, do nothing
      return
    }

    await prisma.order.update({
      where: { id: targetOrder.id },
      data: {
        invoiceSentAt: new Date(),
      },
    })

    revalidatePath(`/dashboard/events/${id}/orders/${submittedOrderId}`)
    revalidatePath(`/dashboard/events/${id}/orders`)
  }

  async function deleteOrderAction(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: { id, deletedAt: null },
      },
      include: {
        items: true,
      },
    })

    if (!targetOrder) {
      throw new Error('Order not found')
    }

    await prisma.$transaction(async (tx) => {
      // Adjust ticket type counts
      for (const item of targetOrder.items) {
        if (targetOrder.status === 'PAID') {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: { soldCount: { decrement: item.quantity } },
          })
        } else if (targetOrder.status === 'PENDING' || targetOrder.status === 'PENDING_INVOICE') {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: { reservedCount: { decrement: item.quantity } },
          })
        }
      }

      // Cascade deletes order items and tickets
      await tx.order.delete({ where: { id: targetOrder.id } })
    })

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')
    redirect(`/dashboard/events/${id}/orders`)
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/events" className="hover:text-gray-700">Events</Link>
        <span>/</span>
        <Link href={`/dashboard/events/${id}`} className="hover:text-gray-700">{order.event.title}</Link>
        <span>/</span>
        <Link href={`/dashboard/events/${id}/orders`} className="hover:text-gray-700">Orders</Link>
        <span>/</span>
        <span className="text-gray-900">{order.orderNumber}</span>
      </nav>

      <OrderDetailView
      order={{
        ...order,
        subtotal: Number(order.subtotal.toString()),
        discountAmount: Number(order.discountAmount.toString()),
        totalAmount: Number(order.totalAmount.toString()),
        invoiceSentAt: order.invoiceSentAt,
        discountCode: order.discountCode?.code ?? null,
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice.toString()),
          totalPrice: Number(item.totalPrice.toString()),
        })),
      }}
      refundAction={refundAction}
      emailAction={emailAction}
      markPaidAction={markPaidAction}
      markInvoiceSentAction={markInvoiceSentAction}
      deleteOrderAction={deleteOrderAction}
    />
    </div>
  )
}
