import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { OrderDetailView } from '@/components/dashboard/OrderDetailView'

type PageProps = {
  params: Promise<{ id: string; orderId: string }>
}

export default async function EventOrderDetailPage({ params }: PageProps) {
  const { organizerProfile } = await requireOrganizerProfile()
  const { id, orderId } = await params

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      eventId: id,
      event: {
        organizerId: organizerProfile.id,
      },
    },
    include: {
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
  })

  if (!order) {
    notFound()
  }

  async function refundAction(formData: FormData) {
    'use server'

    const { organizerProfile: profile } = await requireOrganizerProfile()
    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: {
          organizerId: profile.id,
        },
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

    const { organizerProfile: profile } = await requireOrganizerProfile()
    const submittedOrderId = String(formData.get('orderId') || '')

    const targetOrder = await prisma.order.findFirst({
      where: {
        id: submittedOrderId,
        eventId: id,
        event: {
          organizerId: profile.id,
        },
      },
      include: {
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
      eventTitle: targetOrder.event.title,
      eventDate: targetOrder.event.startDate.toISOString(),
      eventLocation:
        [targetOrder.event.venue, targetOrder.event.city, targetOrder.event.country].filter(Boolean).join(', ') ||
        targetOrder.event.onlineUrl ||
        'TBD',
      tickets: [],
      totalAmount: `${targetOrder.currency} ${targetOrder.totalAmount.toString()}`,
      buyerName: `${targetOrder.buyerFirstName} ${targetOrder.buyerLastName}`.trim(),
    })

    revalidatePath(`/dashboard/events/${id}/orders/${submittedOrderId}`)
  }

  return (
    <OrderDetailView
      order={{
        ...order,
        subtotal: Number(order.subtotal.toString()),
        discountAmount: Number(order.discountAmount.toString()),
        totalAmount: Number(order.totalAmount.toString()),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice.toString()),
          totalPrice: Number(item.totalPrice.toString()),
        })),
      }}
      refundAction={refundAction}
      emailAction={emailAction}
    />
  )
}
