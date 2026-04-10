import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateReceiptPdf } from '@/lib/pdf/receipt'
import { buildReceiptDataForOrder } from '@/lib/pdf/buildReceiptData'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ orderNumber: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orderNumber } = await context.params
    const user = await getCurrentUser()

    // Match the confirmation page's access policy:
    // - Authenticated user: must own the order OR be the organizer of the event
    // - Anonymous: allow lookup by order number (same as /orders/[orderNumber] page)
    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        ...(user && {
          OR: [{ userId: user.id }, { event: { organizer: { userId: user.id } } }],
        }),
      },
      select: { id: true, orderNumber: true, status: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const receiptData = await buildReceiptDataForOrder(prisma, order.id)
    if (!receiptData) {
      return NextResponse.json(
        { error: 'Receipt is not available for this order' },
        { status: 400 }
      )
    }

    const pdfBuffer = await generateReceiptPdf(receiptData)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${order.orderNumber}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Failed to generate receipt PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    )
  }
}
