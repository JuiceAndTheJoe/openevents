import { z } from 'zod'

export const buyerInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  title: z.string().optional(),
  email: z.string().email('Invalid email address'),
  organization: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
})

export const orderItemSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
})

export const createOrderSchema = z.object({
  eventId: z.string().cuid(),
  items: z.array(orderItemSchema).min(1, 'At least one ticket is required'),
  buyer: buyerInfoSchema,
  discountCode: z.string().optional(),
})

export const cancelOrderSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.string().optional(),
})

export const refundOrderSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.string().min(1, 'Refund reason is required'),
  notes: z.string().optional(),
})

export const attendeeInfoSchema = z.object({
  ticketId: z.string().cuid(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
})

export type BuyerInfoInput = z.infer<typeof buyerInfoSchema>
export type OrderItemInput = z.infer<typeof orderItemSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
export type RefundOrderInput = z.infer<typeof refundOrderSchema>
export type AttendeeInfoInput = z.infer<typeof attendeeInfoSchema>
