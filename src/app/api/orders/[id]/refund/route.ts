import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { processRefund } from '@/lib/payments'
import { refundOrderSchema } from '@/lib/validations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const user = await requireAuth()

    const body = await request.json()
    const parsed = refundOrderSchema.safeParse({
      ...body,
      orderId,
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            organizer: {
              select: {
                userId: true,
                orgName: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.event.organizer.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (order.status !== 'PAID' && order.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: `Order cannot be refunded in status ${order.status}` },
        { status: 409 }
      )
    }

    const refundResult = await processRefund({
      paymentId: order.paymentId || order.id,
      reason: parsed.data.reason,
    })

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        refundStatus: 'PENDING',
        refundReason: parsed.data.reason,
        refundNotes: parsed.data.notes,
      },
    })

    await sendEmail({
      to: order.buyerEmail,
      subject: `Refund requested for order #${order.orderNumber}`,
      html: `
        <p>Hi ${order.buyerFirstName},</p>
        <p>Your refund request for <strong>${order.event.title}</strong> has been received and is now pending manual processing.</p>
        <p><strong>Order:</strong> #${order.orderNumber}</p>
        <p><strong>Reason:</strong> ${parsed.data.reason}</p>
        <p>You will receive another email when the refund is processed.</p>
      `,
      text: `Your refund request for order #${order.orderNumber} is pending processing. Reason: ${parsed.data.reason}`,
    })

    return NextResponse.json({
      order: updatedOrder,
      refund: refundResult,
      message: 'Refund has been marked as pending and buyer was notified',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Failed to request refund:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
