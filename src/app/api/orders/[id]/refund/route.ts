import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { processRefund, isPayPalConfigured } from '@/lib/payments'
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

    // Only process PayPal refund if we have a capture ID and PayPal is configured
    let refundResult: { refundId: string; status: string } | null = null
    let refundStatus: 'PENDING' | 'PROCESSED' = 'PENDING'

    if (order.paymentId && order.paymentMethod === 'PAYPAL' && isPayPalConfigured()) {
      try {
        refundResult = await processRefund({
          captureId: order.paymentId,
          amount: Number(order.totalAmount),
          currency: order.currency,
          reason: parsed.data.reason,
        })

        // If PayPal refund completed immediately, mark as processed
        if (refundResult.status === 'completed') {
          refundStatus = 'PROCESSED'
        }
      } catch (refundError) {
        console.error('PayPal refund failed:', refundError)
        // Continue with pending status - can be processed manually
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: refundStatus === 'PROCESSED' ? 'REFUNDED' : order.status,
        refundStatus,
        refundReason: parsed.data.reason,
        refundNotes: parsed.data.notes,
        refundedAt: refundStatus === 'PROCESSED' ? new Date() : null,
      },
    })

    // Send appropriate email based on refund status
    if (refundStatus === 'PROCESSED') {
      await sendEmail({
        to: order.buyerEmail,
        subject: `Refund completed for order #${order.orderNumber}`,
        html: `
          <p>Hi ${order.buyerFirstName},</p>
          <p>Your refund for <strong>${order.event.title}</strong> has been processed.</p>
          <p><strong>Order:</strong> #${order.orderNumber}</p>
          <p><strong>Amount:</strong> ${order.totalAmount} ${order.currency}</p>
          <p>The funds should appear in your PayPal account within a few business days.</p>
        `,
        text: `Your refund for order #${order.orderNumber} has been processed. Amount: ${order.totalAmount} ${order.currency}`,
      })
    } else {
      await sendEmail({
        to: order.buyerEmail,
        subject: `Refund requested for order #${order.orderNumber}`,
        html: `
          <p>Hi ${order.buyerFirstName},</p>
          <p>Your refund request for <strong>${order.event.title}</strong> has been received and is being processed.</p>
          <p><strong>Order:</strong> #${order.orderNumber}</p>
          <p><strong>Reason:</strong> ${parsed.data.reason}</p>
          <p>You will receive another email when the refund is completed.</p>
        `,
        text: `Your refund request for order #${order.orderNumber} is being processed. Reason: ${parsed.data.reason}`,
      })
    }

    return NextResponse.json({
      order: updatedOrder,
      refund: refundResult,
      message: refundStatus === 'PROCESSED'
        ? 'Refund has been processed successfully'
        : 'Refund has been marked as pending and buyer was notified',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Failed to request refund:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
