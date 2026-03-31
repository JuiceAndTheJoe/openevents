import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Mark an invoice order's invoice as sent
 * This endpoint is used when an organizer has sent the invoice to the buyer.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const user = await requireAuth()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        invoiceSentAt: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only organizers or super admins can mark invoice as sent
    const hasOrganizerRole = user.roles.includes('ORGANIZER') || user.roles.includes('SUPER_ADMIN')
    if (!hasOrganizerRole) {
      return NextResponse.json(
        { error: 'Only event organizers can mark invoice as sent' },
        { status: 403 }
      )
    }

    if (order.status !== 'PENDING_INVOICE') {
      return NextResponse.json(
        { error: `Only pending invoice orders can have their invoice marked as sent. Current status: ${order.status}` },
        { status: 409 }
      )
    }

    if (order.invoiceSentAt) {
      return NextResponse.json({
        message: 'Invoice already marked as sent',
        invoiceSentAt: order.invoiceSentAt,
      })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        invoiceSentAt: new Date(),
      },
      select: {
        id: true,
        orderNumber: true,
        invoiceSentAt: true,
      },
    })

    return NextResponse.json({
      order: updatedOrder,
      message: 'Invoice marked as sent successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.error('Failed to mark invoice as sent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
