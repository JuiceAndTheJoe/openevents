import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { sendEventCancellationEmail } from '@/lib/email'
import { formatDateTime } from '@/lib/utils'

const cancelBodySchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

function queueCancellationEmails(
  orders: Array<{
    buyerEmail: string
    buyerFirstName: string
    buyerLastName: string
    orderNumber: string
  }>,
  eventTitle: string,
  eventDate: string
) {
  void Promise.allSettled(
    orders.map((order) =>
      sendEventCancellationEmail(order.buyerEmail, {
        eventTitle,
        eventDate,
        buyerName: `${order.buyerFirstName} ${order.buyerLastName}`.trim() || 'Attendee',
        orderNumber: order.orderNumber,
      })
    )
  ).then((results) => {
    const failedCount = results.filter((result) => result.status === 'rejected').length
    if (failedCount > 0) {
      console.error(`Failed to send ${failedCount} cancellation emails`)
    }
  })
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRole('ORGANIZER')
    const { id } = await context.params

    const body = await request.json().catch(() => ({}))
    const parsed = cancelBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.organizer.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (event.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Event is already cancelled' },
        { status: 400 }
      )
    }

    if (event.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Completed events cannot be cancelled' },
        { status: 400 }
      )
    }

    const [cancelledEvent, orders] = await prisma.$transaction([
      prisma.event.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          descriptionHtml: parsed.data.reason
            ? `${event.descriptionHtml || ''}\n\n<p><strong>Cancellation reason:</strong> ${parsed.data.reason}</p>`
            : event.descriptionHtml,
        },
      }),
      prisma.order.findMany({
        where: {
          eventId: id,
          status: {
            in: ['PAID', 'PENDING_INVOICE', 'PENDING'],
          },
        },
        select: {
          buyerEmail: true,
          buyerFirstName: true,
          buyerLastName: true,
          orderNumber: true,
        },
      }),
    ])

    queueCancellationEmails(
      orders,
      cancelledEvent.title,
      formatDateTime(cancelledEvent.startDate)
    )

    return NextResponse.json({
      data: cancelledEvent,
      message: `Event cancelled. Queued ${orders.length} cancellation email notifications.`,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    console.error('Cancel event failed:', error)
    return NextResponse.json(
      { error: 'Failed to cancel event' },
      { status: 500 }
    )
  }
}
