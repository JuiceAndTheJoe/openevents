import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateReceiptPdf, type ReceiptData } from '@/lib/pdf/receipt'

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
      include: {
        event: {
          select: {
            title: true,
            startDate: true,
            locationType: true,
            venue: true,
            city: true,
            country: true,
            onlineUrl: true,
            organization: true,
            organizationNumber: true,
            organizationAddress: true,
            organizer: {
              select: {
                orgName: true,
                website: true,
              },
            },
          },
        },
        items: {
          include: {
            ticketType: {
              select: {
                name: true,
              },
            },
          },
        },
        groupDiscount: {
          select: {
            minQuantity: true,
            discountType: true,
            discountValue: true,
          },
        },
        discountCode: {
          select: {
            code: true,
            discountType: true,
            discountValue: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Don't issue receipts for orders that aren't financially settled in any way.
    // PENDING (temporary pre-payment hold) and CANCELLED are excluded.
    const allowedStatuses = ['PAID', 'PENDING_INVOICE', 'REFUNDED', 'PARTIALLY_REFUNDED']
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: 'Receipt is not available for this order' },
        { status: 400 }
      )
    }

    const eventLocation =
      order.event.locationType === 'ONLINE'
        ? order.event.onlineUrl || 'Online event'
        : [order.event.venue, order.event.city, order.event.country]
            .filter(Boolean)
            .join(', ') || 'Location TBD'

    const buyerName = `${order.buyerFirstName} ${order.buyerLastName}`.trim()

    const items = order.items.map((item) => {
      const unitPrice = Number(item.unitPrice)
      return {
        name: item.ticketType.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: Number(item.totalPrice),
      }
    })

    let discountLabel: string | null = null
    if (order.groupDiscount) {
      const value = Number(order.groupDiscount.discountValue)
      const valueLabel =
        order.groupDiscount.discountType === 'PERCENTAGE'
          ? `${value}%`
          : `${value} ${order.currency}`
      discountLabel = `group ${order.groupDiscount.minQuantity}+, ${valueLabel} off`
    } else if (order.discountCode) {
      discountLabel = `code ${order.discountCode.code}`
    }

    const receiptData: ReceiptData = {
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      paidAt: order.paidAt,
      status: order.status,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      seller: {
        // Legal issuer name is per-event (falls back to the organizer's name
        // for legacy events that predate the per-event issuer fields).
        name: order.event.organization || order.event.organizer.orgName || 'Event Organizer',
        displayName: null,
        website: order.event.organizer.website,
        orgNumber: order.event.organizationNumber,
        address: order.event.organizationAddress,
      },
      buyer: {
        name: buyerName,
        email: order.buyerEmail,
        title: order.buyerTitle,
        organization: order.buyerOrganization,
        address: order.buyerAddress,
        city: order.buyerCity,
        postalCode: order.buyerPostalCode,
        country: order.buyerCountry,
      },
      event: {
        title: order.event.title,
        startDate: order.event.startDate,
        location: eventLocation,
      },
      items,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      discountLabel,
      vatRate: Number(order.vatRate),
      vatAmount: Number(order.vatAmount),
      totalAmount: Number(order.totalAmount),
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
