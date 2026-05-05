import { OrderStatus, PaymentMethod } from '@prisma/client'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PENDING_INVOICE: 'Pending Invoice',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially Refunded',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PAYPAL: 'Stripe',
  INVOICE: 'Invoice',
  FREE: 'Free',
}
