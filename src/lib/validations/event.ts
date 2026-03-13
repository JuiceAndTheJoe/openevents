import { z } from 'zod'
import { isValidTimeZone } from '@/lib/timezone'

const eventSchemaBase = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().optional(),
  descriptionHtml: z.string().optional(),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  timezone: z.string().refine((value) => isValidTimeZone(value), 'Invalid timezone').default('UTC'),
  locationType: z.enum(['PHYSICAL', 'ONLINE', 'HYBRID']).default('PHYSICAL'),
  venue: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  onlineUrl: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  bottomImage: z.string().url().optional().nullable(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  cancellationDeadlineHours: z.number().min(0).default(48),
  categoryIds: z.array(z.string()).optional(),
  speakerNames: z.array(z.string()).optional(),
  organizerNames: z.array(z.string()).optional(),
  sponsorNames: z.array(z.string()).optional(),
  speakerPhotos: z.array(z.string()).optional(),
  speakerLinks: z.array(z.string()).optional(),
  autoCreateFreeTicket: z.boolean().optional().default(false),
})

export const createEventSchema = eventSchemaBase
  .refine((data) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(data.startDate)
    startDate.setHours(0, 0, 0, 0)
    return startDate >= today
  }, {
    message: 'Start date cannot be in the past',
    path: ['startDate'],
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  })

export const updateEventSchema = eventSchemaBase.partial().refine((data) => {
  if (!data.startDate || !data.endDate) return true
  return new Date(data.endDate) > new Date(data.startDate)
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

export const publishEventSchema = z.object({
  eventId: z.string().cuid(),
})

export const cancelEventSchema = z.object({
  eventId: z.string().cuid(),
  reason: z.string().optional(),
})

export const agendaItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startTime: z.string().datetime('Invalid start time'),
  endTime: z.string().datetime().optional(),
  speakerId: z.string().cuid().optional().nullable(),
  sortOrder: z.number().default(0),
})

export const speakerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  title: z.string().optional(),
  bio: z.string().optional(),
  photo: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  sortOrder: z.number().default(0),
})

export const eventMediaSchema = z.object({
  url: z.string().url('Invalid URL'),
  type: z.enum(['IMAGE', 'VIDEO']),
  title: z.string().optional(),
  sortOrder: z.number().default(0),
})

const groupDiscountBaseSchema = z.object({
  ticketTypeId: z.string().cuid().optional().nullable(),
  minQuantity: z.number().min(1, 'Minimum quantity must be at least 1'),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.number().min(0, 'Discount value must be positive').refine((val) => val > 0, {
    message: 'Discount value must be greater than 0',
  }),
  isActive: z.boolean().default(true),
})

export const groupDiscountSchema = groupDiscountBaseSchema.refine((data) => {
  if (data.discountType === 'PERCENTAGE') {
    return data.discountValue <= 100
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue'],
})

export const updateGroupDiscountSchema = groupDiscountBaseSchema.partial().refine((data) => {
  if (data.discountType === 'PERCENTAGE' && data.discountValue !== undefined) {
    return data.discountValue <= 100
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discountValue'],
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type AgendaItemInput = z.infer<typeof agendaItemSchema>
export type SpeakerInput = z.infer<typeof speakerSchema>
export type EventMediaInput = z.infer<typeof eventMediaSchema>
export type GroupDiscountInput = z.infer<typeof groupDiscountSchema>
export type UpdateGroupDiscountInput = z.infer<typeof updateGroupDiscountSchema>
