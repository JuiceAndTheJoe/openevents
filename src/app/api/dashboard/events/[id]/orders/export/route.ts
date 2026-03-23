import { NextResponse } from 'next/server'
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'

type RouteContext = {
  params: Promise<{ id: string }>
}

function csvCell(value: string | number | null) {
  const str = value === null ? '' : String(value)
  return `"${str.replaceAll('"', '""')}"`
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireOrganizerProfile()
    const { id } = await context.params

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') as OrderStatus | null
    const paymentMethod = searchParams.get('paymentMethod') as PaymentMethod | null
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const where: Prisma.OrderWhereInput = {
      eventId: id,
      event: { id, deletedAt: null },
    }

    if (status && ['PENDING', 'PENDING_INVOICE', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)) {
      where.status = status
    }

    if (paymentMethod && ['PAYPAL', 'INVOICE', 'FREE'].includes(paymentMethod)) {
      where.paymentMethod = paymentMethod
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { buyerEmail: { contains: search, mode: 'insensitive' } },
        { buyerFirstName: { contains: search, mode: 'insensitive' } },
        { buyerLastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        gte: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined,
        lte: dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined,
      }
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        orderNumber: true,
        buyerFirstName: true,
        buyerLastName: true,
        buyerEmail: true,
        status: true,
        paymentMethod: true,
        subtotal: true,
        discountAmount: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const header = ['orderNumber', 'buyerName', 'buyerEmail', 'status', 'paymentMethod', 'subtotal', 'discountAmount', 'totalAmount', 'currency', 'createdAt']
    const lines = [header.join(',')]

    for (const order of orders) {
      lines.push([
        csvCell(order.orderNumber),
        csvCell(`${order.buyerFirstName} ${order.buyerLastName}`.trim()),
        csvCell(order.buyerEmail),
        csvCell(order.status),
        csvCell(order.paymentMethod),
        csvCell(order.subtotal.toString()),
        csvCell(order.discountAmount.toString()),
        csvCell(order.totalAmount.toString()),
        csvCell(order.currency),
        csvCell(order.createdAt.toISOString()),
      ].join(','))
    }

    const csv = lines.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${id}-orders.csv"`,
      },
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

    console.error('Order export failed:', error)
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 })
  }
}
