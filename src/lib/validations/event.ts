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
  venue: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  onlineUrl: z.string().url().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  bottomImage: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  cancellationDeadlineHours: z.number().min(0).default(48),
  categoryIds: z.array(z.string()).optional(),
  speakerNames: z.array(z.string()).optional(),
  organizerNames: z.array(z.string()).optional(),
  sponsorNames: z.array(z.string()).optional(),
  speakerPhotos: z.array(z.string()).optional(),
  autoCreateFreeTicket: z.boolean().optional().default(false),
})

export const createEventSchema = eventSchemaBase.refine((data) => new Date(data.endDate) > new Date(data.startDate), {
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

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type AgendaItemInput = z.infer<typeof agendaItemSchema>
export type SpeakerInput = z.infer<typeof speakerSchema>
export type EventMediaInput = z.infer<typeof eventMediaSchema>
