import { NextRequest, NextResponse } from 'next/server'
import { hasRole, requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const user = await requireAuth()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isOwner = order.userId === user.id
    const isSuperAdmin = hasRole(user.roles, 'SUPER_ADMIN')

    if (!isOwner && !isSuperAdmin) {
      const event = await prisma.event.findUnique({
        where: { id: order.eventId },
        select: {
          organizer: {
            select: {
              userId: true,
            },
          },
        },
      })

      const isEventOrganizer = event?.organizer?.userId === user.id
      if (!isEventOrganizer) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Get order failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
