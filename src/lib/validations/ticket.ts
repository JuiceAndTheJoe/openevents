import { z } from 'zod'

const ticketTypeBaseSchema = z.object({
  eventId: z.string().cuid(),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be 0 or greater'),
  currency: z.string().default('SEK'),
  maxCapacity: z.number().int().positive().optional().nullable(),
  salesStartDate: z.string().datetime().optional().nullable(),
  salesEndDate: z.string().datetime().optional().nullable(),
  isVisible: z.boolean().default(true),
  maxPerOrder: z.number().int().min(1).default(10),
  minPerOrder: z.number().int().min(1).default(1),
  sortOrder: z.number().default(0),
})

export const createTicketTypeSchema = ticketTypeBaseSchema.refine((data) => {
  if (data.salesStartDate && data.salesEndDate) {
    return new Date(data.salesEndDate) > new Date(data.salesStartDate)
  }
  return true
}, {
  message: 'Sales end date must be after start date',
  path: ['salesEndDate'],
})

export const updateTicketTypeSchema = ticketTypeBaseSchema.partial().omit({ eventId: true })

const discountCodeBaseSchema = z.object({
  eventId: z.string().cuid(),
  code: z.string()
    .min(3, 'Code must be at least 3 characters')
    .max(20, 'Code must be at most 20 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Code can only contain letters, numbers, underscores, and hyphens'),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_TICKET', 'INVOICE']),
  discountValue: z.number().min(0),
  maxUses: z.number().int().positive().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
  ticketTypeIds: z.array(z.string().cuid()).optional(), // Empty = applies to all
})

export const createDiscountCodeSchema = discountCodeBaseSchema.refine((data) => {
  // For percentage, value must be between 0 and 100
  if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue'],
}).refine((data) => {
  // FREE_TICKET and INVOICE don't need a discount value
  if (data.discountType === 'FREE_TICKET' || data.discountType === 'INVOICE') {
    return true
  }
  return data.discountValue > 0
}, {
  message: 'Discount value must be greater than 0',
  path: ['discountValue'],
})

export const updateDiscountCodeSchema = discountCodeBaseSchema.partial().omit({ eventId: true })

export const validateDiscountCodeSchema = z.object({
  eventId: z.string().cuid(),
  code: z.string().min(1),
  ticketTypeIds: z.array(z.string().cuid()).optional(),
})

export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>
export type CreateDiscountCodeInput = z.infer<typeof createDiscountCodeSchema>
export type UpdateDiscountCodeInput = z.infer<typeof updateDiscountCodeSchema>
export type ValidateDiscountCodeInput = z.infer<typeof validateDiscountCodeSchema>
