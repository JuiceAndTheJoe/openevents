import type { PrismaClient } from '@prisma/client'
import type { ReceiptData } from '@/lib/pdf/receipt'

const RECEIPT_ELIGIBLE_STATUSES = new Set([
  'PAID',
  'PENDING_INVOICE',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
])

/**
 * Build a ReceiptData payload for an order, ready to hand to generateReceiptPdf.
 *
 * Returns null if the order cannot be found, or if its status is not one that
 * warrants a receipt (PENDING pre-payment holds and CANCELLED orders).
 *
 * Used by both the download-receipt API route and the order confirmation email
 * so the two code paths share the same derivation of seller/buyer/items/totals.
 */
export async function buildReceiptDataForOrder(
  prisma: PrismaClient,
  orderId: string
): Promise<ReceiptData | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
          organizationVatNumber: true,
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
            select: { name: true },
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

  if (!order) return null
  if (!RECEIPT_ELIGIBLE_STATUSES.has(order.status)) return null

  const eventLocation =
    order.event.locationType === 'ONLINE'
      ? order.event.onlineUrl || 'Online event'
      : [order.event.venue, order.event.city, order.event.country]
          .filter(Boolean)
          .join(', ') || 'Location TBD'

  const items = order.items.map((item) => ({
    name: item.ticketType.name,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.totalPrice),
  }))

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

  return {
    orderNumber: order.orderNumber,
    orderDate: order.createdAt,
    paidAt: order.paidAt,
    status: order.status,
    paymentMethod: order.paymentMethod,
    currency: order.currency,
    seller: {
      name: order.event.organization || order.event.organizer.orgName || 'Event Organizer',
      displayName: null,
      website: order.event.organizer.website,
      orgNumber: order.event.organizationNumber,
      vatNumber: order.event.organizationVatNumber,
      address: order.event.organizationAddress,
    },
    buyer: {
      name: `${order.buyerFirstName} ${order.buyerLastName}`.trim(),
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
}
