'use client'

import Cropper, { Area } from 'react-easy-crop'
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Image as ImageIcon, Plus, Trash2, Upload, User, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingToast } from '@/components/ui/floating-toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_CURRENCY, isSupportedCurrency } from '@/lib/constants/currencies'
import {
  convertDateTimeLocalBetweenTimeZones,
  dateTimeLocalInTimeZoneToUtcIso,
  formatUtcInTimeZoneForInput,
  isValidTimeZone,
} from '@/lib/timezone'

type EventFormMode = 'create' | 'edit'
type ImageTargetField = 'coverImage' | 'bottomImage'
type TicketTypeFieldKey = 'name' | 'price' | 'currency' | 'capacity'
type TicketTypeFieldErrors = Partial<Record<TicketTypeFieldKey, string>>

type PromoCodeDraft = {
  id?: string
  code: string
  discountValue: string
  ticketTypeId: string
  maxUses: string
  minCartAmount: string
}

type TicketTypeDraft = {
  id?: string
  name: string
  price: string
  currency: string
  capacity: string
}

type EventFormData = {
  id?: string
  slug?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
  ticketTypes?: TicketTypeDraft[]
  ticketTypeId?: string
  ticketTypeName?: string
  ticketPrice?: string
  ticketCurrency?: string
  ticketCapacity?: string
  title: string
  description?: string | null
  descriptionHtml?: string | null
  startDate: string
  endDate: string
  timezone: string
  locationType: 'PHYSICAL' | 'ONLINE' | 'HYBRID'
  venue?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  onlineUrl?: string | null
  coverImage?: string | null
  bottomImage?: string | null
  videoUrl?: string | null
  speakerNames?: string
  organizerNames?: string
  sponsorNames?: string
  visibility: 'PUBLIC' | 'PRIVATE'
  cancellationDeadlineHours: number
  categoryIds?: string[]
}

type Category = { id: string; name: string }

type InitialSpeaker = {
  id?: string
  name: string
  title: string
  organization: string
  photo: string
}

type EventFormProps = {
  mode: EventFormMode
  initialData?: EventFormData
  initialSpeakers?: InitialSpeaker[]
  categories?: Category[]
  initialPromoCodes?: PromoCodeDraft[]
}

type FieldKey =
  | 'title'
  | 'description'
  | 'startDate'
  | 'endDate'
  | 'timezone'
  | 'venue'
  | 'address'
  | 'city'
  | 'country'
  | 'onlineUrl'
  | 'coverImage'
  | 'bottomImage'
  | 'videoUrl'

type FieldErrors = Partial<Record<FieldKey, string>>

type CropSession = {
  targetField: ImageTargetField
  sourceUrl: string
  fileName: string
  mimeType: string
}

type SpeakerDraft = {
  key: string
  speakerId?: string
  name: string
  title: string
  organization: string
  originalFile: File | null
  croppedFile: File | null
  previewUrl: string | null
  publicUrl: string
  isUploading: boolean
}

type SpeakerCropSession = {
  speakerKey: string
  sourceUrl: string
  fileName: string
  mimeType: string
}

// ── Date & Time picker helpers (module-level, never recreated) ────────────────

const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
)

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = new Date(year, month, 1).getDay()
  const cells: (number | null)[] = [
    ...Array<null>(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ─────────────────────────────────────────────────────────────────────────────

const fallbackInitialData: EventFormData = {
  status: 'DRAFT',
  ticketTypes: [{
    name: 'General Admission',
    price: '0',
    currency: DEFAULT_CURRENCY,
    capacity: '',
  }],
  ticketTypeId: '',
  ticketTypeName: 'General Admission',
  ticketPrice: '0',
  ticketCurrency: DEFAULT_CURRENCY,
  ticketCapacity: '',
  title: '',
  description: '',
  descriptionHtml: '',
  startDate: '',
  endDate: '',
  timezone: 'UTC',
  locationType: 'PHYSICAL',
  venue: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  onlineUrl: '',
  coverImage: '',
  bottomImage: '',
  videoUrl: '',
  speakerNames: '',
  organizerNames: '',
  sponsorNames: '',
  visibility: 'PUBLIC',
  cancellationDeadlineHours: 48,
  categoryIds: [],
}

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const allowedVideoMimeTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

const fieldOrder: FieldKey[] = [
  'title',
  'startDate',
  'endDate',
  'timezone',
  'venue',
  'address',
  'city',
  'country',
  'onlineUrl',
  'description',
  'coverImage',
  'bottomImage',
  'videoUrl',
]

const ticketFieldOrder: TicketTypeFieldKey[] = ['name', 'price', 'currency', 'capacity']

const commonTimezones = [
  'UTC',
  'Europe/Stockholm',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Dubai',
]


function parseTicketPrice(raw?: string): number | null {
  if (!raw?.trim()) return null
  const parsed = Number(raw)
  if (Number.isNaN(parsed)) return null
  return parsed
}

function normalizeTicketCurrency(raw?: string) {
  return (raw || DEFAULT_CURRENCY).trim().toUpperCase()
}

function normalizeTicketDraft(ticket?: Partial<TicketTypeDraft>): TicketTypeDraft {
  return {
    id: ticket?.id,
    name: ticket?.name || '',
    price: ticket?.price || '0',
    currency: normalizeTicketCurrency(ticket?.currency),
    capacity: ticket?.capacity || '',
  }
}

function hasAnyTicketInput(ticket: TicketTypeDraft) {
  return (
    Boolean(ticket.id) ||
    Boolean(ticket.name.trim()) ||
    Boolean(ticket.price.trim()) ||
    Boolean(ticket.capacity.trim())
  )
}

function createEmptyTicketType() {
  return normalizeTicketDraft()
}

function parseFirstFieldError(details: unknown, key: string) {
  if (!details || typeof details !== 'object') return null

  const detailsRecord = details as Record<string, unknown>
  const fieldErrors = detailsRecord.fieldErrors
  if (!fieldErrors || typeof fieldErrors !== 'object') return null

  const value = (fieldErrors as Record<string, unknown>)[key]
  if (!Array.isArray(value) || value.length < 1) return null

  const firstError = value[0]
  return typeof firstError === 'string' ? firstError : null
}

function parseApiValidationErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== 'object') return {}

  const mapped: FieldErrors = {}
  const record = details as Record<string, unknown>

  for (const key of fieldOrder) {
    const value = record[key]
    if (Array.isArray(value) && typeof value[0] === 'string') {
      mapped[key] = value[0]
    }
  }

  return mapped
}

function parsePublishIssueFieldErrors(details: unknown): FieldErrors {
  if (!Array.isArray(details)) return {}

  const fieldMap: Record<string, FieldKey> = {
    Title: 'title',
    Start: 'startDate',
    End: 'endDate',
    Timezone: 'timezone',
    Venue: 'venue',
    Address: 'address',
    City: 'city',
    Country: 'country',
    'Online URL': 'onlineUrl',
    Description: 'description',
  }

  const nextFieldErrors: FieldErrors = {}

  for (const issue of details) {
    if (!issue || typeof issue !== 'object') continue
    const issueRecord = issue as Record<string, unknown>
    const field = issueRecord.field
    const message = issueRecord.message
    if (typeof field !== 'string' || typeof message !== 'string') continue

    const mappedField = fieldMap[field]
    if (mappedField && !nextFieldErrors[mappedField]) {
      nextFieldErrors[mappedField] = message
    }
  }

  return nextFieldErrors
}

function focusFieldById(id: string) {
  requestAnimationFrame(() => {
    const element = document.getElementById(id)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      element.focus()
    }
  })
}

function focusFirstInvalidField(fieldErrors: FieldErrors, ticketErrors: TicketTypeFieldErrors[]) {
  const first = fieldOrder.find((key) => Boolean(fieldErrors[key]))
  if (first) {
    focusFieldById(first)
    return
  }

  for (let index = 0; index < ticketErrors.length; index += 1) {
    const rowErrors = ticketErrors[index]
    const firstTicketField = ticketFieldOrder.find((key) => Boolean(rowErrors[key]))
    if (firstTicketField) {
      if (firstTicketField === 'name') {
        focusFieldById(`ticketTypeName-${index}`)
      } else if (firstTicketField === 'price') {
        focusFieldById(`ticketPrice-${index}`)
      } else if (firstTicketField === 'currency') {
        focusFieldById(`ticketCurrency-${index}`)
      } else {
        focusFieldById(`ticketCapacity-${index}`)
      }
      return
    }
  }
}

function loadTimezoneOptions(initialTimeZone: string) {
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const dynamicTimezones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []

  return Array.from(
    new Set([
      ...commonTimezones,
      ...dynamicTimezones,
      localZone,
      initialTimeZone,
    ].filter(Boolean))
  )
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image for cropping'))
    image.src = src
  })
}

async function cropImageToFile(params: {
  sourceUrl: string
  cropPixels: Area
  fileName: string
  mimeType: string
}) {
  const image = await loadImage(params.sourceUrl)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(params.cropPixels.width))
  canvas.height = Math.max(1, Math.round(params.cropPixels.height))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to edit this image')

  context.drawImage(
    image,
    params.cropPixels.x,
    params.cropPixels.y,
    params.cropPixels.width,
    params.cropPixels.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  const outputMimeType = allowedImageMimeTypes.has(params.mimeType) ? params.mimeType : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputMimeType, 0.92))
  if (!blob) throw new Error('Failed to apply crop')

  return new File([blob], params.fileName, { type: outputMimeType })
}

function createFileNameFromMimeType(targetField: ImageTargetField, mimeType: string) {
  const extension = mimeType.split('/')[1] || 'jpg'
  const prefix = targetField === 'coverImage' ? 'cover' : 'bottom'
  return `${prefix}.${extension}`
}

function buildSnapshot(form: EventFormData) {
  return JSON.stringify({
    title: form.title,
    description: form.description || '',
    startDate: form.startDate,
    endDate: form.endDate,
    timezone: form.timezone,
    locationType: form.locationType,
    venue: form.venue || '',
    address: form.address || '',
    city: form.city || '',
    state: form.state || '',
    country: form.country || '',
    postalCode: form.postalCode || '',
    onlineUrl: form.onlineUrl || '',
    ticketTypes: (form.ticketTypes || []).map((ticket) => ({
      id: ticket.id || '',
      name: ticket.name.trim(),
      price: ticket.price.trim(),
      currency: normalizeTicketCurrency(ticket.currency),
      capacity: ticket.capacity.trim(),
    })),
    speakerNames: form.speakerNames || '',
    organizerNames: form.organizerNames || '',
    sponsorNames: form.sponsorNames || '',
    visibility: form.visibility,
    cancellationDeadlineHours: form.cancellationDeadlineHours,
    categoryIds: form.categoryIds || [],
    coverImage: form.coverImage || '',
    bottomImage: form.bottomImage || '',
    videoUrl: form.videoUrl || '',
  })
}

export function EventForm({ mode, initialData, initialSpeakers, categories = [], initialPromoCodes = [] }: EventFormProps) {
  const router = useRouter()
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const bottomInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const bannerObjectUrlRef = useRef<string | null>(null)
  const bottomObjectUrlRef = useRef<string | null>(null)
  const videoObjectUrlRef = useRef<string | null>(null)
  const cropObjectUrlRef = useRef<string | null>(null)
  const speakerImageInputRef = useRef<HTMLInputElement | null>(null)
  const speakerImageTargetKeyRef = useRef<string>('')
  const speakerCropObjectUrlRef = useRef<string | null>(null)
  const speakerPreviewUrlsRef = useRef<Map<string, string>>(new Map())

  const mergedInitialData = useMemo(() => ({ ...fallbackInitialData, ...initialData }), [initialData])

  const normalizedInitialTimezone = isValidTimeZone(mergedInitialData.timezone)
    ? mergedInitialData.timezone
    : 'UTC'

  const initialTicketTypes = useMemo(() => {
    if (mergedInitialData.ticketTypes && mergedInitialData.ticketTypes.length > 0) {
      return mergedInitialData.ticketTypes.map((ticket) => normalizeTicketDraft(ticket))
    }

    return [normalizeTicketDraft({
      id: mergedInitialData.ticketTypeId,
      name: mergedInitialData.ticketTypeName,
      price: mergedInitialData.ticketPrice,
      currency: mergedInitialData.ticketCurrency,
      capacity: mergedInitialData.ticketCapacity,
    })]
  }, [mergedInitialData])

  const initialFormState = useMemo<EventFormData>(() => ({
    ...mergedInitialData,
    timezone: normalizedInitialTimezone,
    description: mergedInitialData.description || mergedInitialData.descriptionHtml || '',
    startDate: formatUtcInTimeZoneForInput(mergedInitialData.startDate, normalizedInitialTimezone),
    endDate: formatUtcInTimeZoneForInput(mergedInitialData.endDate, normalizedInitialTimezone),
    ticketTypes: initialTicketTypes,
    ticketCurrency: normalizeTicketCurrency(mergedInitialData.ticketCurrency),
  }), [initialTicketTypes, mergedInitialData, normalizedInitialTimezone])

  const initialSnapshotRef = useRef(buildSnapshot(initialFormState))

  const [form, setForm] = useState<EventFormData>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isUploadingBottom, setIsUploadingBottom] = useState(false)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [cancellationUnit, setCancellationUnit] = useState<'hours' | 'days'>(() => {
    const h = mergedInitialData.cancellationDeadlineHours ?? 48
    return h >= 24 && h % 24 === 0 ? 'days' : 'hours'
  })
  const [isPreparingCrop, setIsPreparingCrop] = useState<ImageTargetField | null>(null)
  const [isApplyingCrop, setIsApplyingCrop] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [ticketErrors, setTicketErrors] = useState<TicketTypeFieldErrors[]>(
    initialTicketTypes.map(() => ({}))
  )
  const [generalErrors, setGeneralErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null)
  const [isUnitOpen, setIsUnitOpen] = useState(false)
  const unitDropdownRef = useRef<HTMLDivElement | null>(null)
  const [openDateTimePanel, setOpenDateTimePanel] = useState<'startDate' | 'endDate' | 'startTime' | 'endTime' | null>(null)
  const [calendarNav, setCalendarNav] = useState<{ year: number; month: number }>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const dateTimePanelRef = useRef<HTMLDivElement | null>(null)
  const [bannerPreviewSrc, setBannerPreviewSrc] = useState<string | null>(null)
  const [bottomPreviewSrc, setBottomPreviewSrc] = useState<string | null>(null)
  const [videoPreviewSrc, setVideoPreviewSrc] = useState<string | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [cropSession, setCropSession] = useState<CropSession | null>(null)
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [cropPixels, setCropPixels] = useState<Area | null>(null)
  const [activeDropTarget, setActiveDropTarget] = useState<ImageTargetField | null>(null)
  const [speakerDrafts, setSpeakerDrafts] = useState<SpeakerDraft[]>(() =>
    (initialSpeakers ?? []).map((s, i) => ({
      key: `speaker-init-${i}`,
      speakerId: s.id,
      name: s.name,
      title: s.title,
      organization: s.organization,
      originalFile: null,
      croppedFile: null,
      previewUrl: null,
      publicUrl: s.photo,
      isUploading: false,
    }))
  )
  const [speakerCropSession, setSpeakerCropSession] = useState<SpeakerCropSession | null>(null)
  const [speakerCropPosition, setSpeakerCropPosition] = useState({ x: 0, y: 0 })
  const [speakerCropZoom, setSpeakerCropZoom] = useState(1)
  const [speakerCropPixels, setSpeakerCropPixels] = useState<Area | null>(null)
  const [isApplyingSpeakerCrop, setIsApplyingSpeakerCrop] = useState(false)
  const [originalImageFiles, setOriginalImageFiles] = useState<Record<ImageTargetField, File | null>>({
    coverImage: null,
    bottomImage: null,
  })
  const [croppedImageFiles, setCroppedImageFiles] = useState<Record<ImageTargetField, File | null>>({
    coverImage: null,
    bottomImage: null,
  })
  const [editableImageFiles, setEditableImageFiles] = useState<Record<ImageTargetField, File | null>>({
    coverImage: null,
    bottomImage: null,
  })
  const persistedTicketTypeIdsRef = useRef(
    new Set(initialTicketTypes.map((ticket) => ticket.id).filter((ticketId): ticketId is string => Boolean(ticketId)))
  )

  const [promoCodes, setPromoCodes] = useState<PromoCodeDraft[]>(initialPromoCodes)
  const persistedPromoCodeIdsRef = useRef(
    new Set(initialPromoCodes.map((c) => c.id).filter((id): id is string => Boolean(id)))
  )

  const timezoneOptions = useMemo(() => loadTimezoneOptions(normalizedInitialTimezone), [normalizedInitialTimezone])

  const clearFieldError = (key: FieldKey) => {
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const updateField = <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (key in fieldErrors) {
      clearFieldError(key as FieldKey)
    }
  }

  // ── Date/time picker helpers ──────────────────────────────────────────────

  const getDatePart = (dt: string) => dt.split('T')[0] ?? ''
  const getTimePart = (dt: string) => dt.split('T')[1] ?? ''

  const updateDatePart = (field: 'startDate' | 'endDate', datePart: string) => {
    const timePart = getTimePart(form[field])
    updateField(field, timePart ? `${datePart}T${timePart}` : `${datePart}T00:00`)
  }

  const updateTimePart = (field: 'startDate' | 'endDate', timePart: string) => {
    const datePart = getDatePart(form[field])
    if (datePart) updateField(field, `${datePart}T${timePart}`)
  }

  const updateHourPart = (field: 'startDate' | 'endDate', hour: string) => {
    const existing = getTimePart(form[field])
    const minute = existing ? (existing.split(':')[1] ?? '00') : '00'
    updateTimePart(field, `${hour}:${minute}`)
  }

  const updateMinutePart = (field: 'startDate' | 'endDate', minute: string) => {
    const existing = getTimePart(form[field])
    const hour = existing ? (existing.split(':')[0] ?? '00') : '00'
    updateTimePart(field, `${hour}:${minute}`)
  }

  const isDatePickerDaySelected = (field: 'startDate' | 'endDate', year: number, month: number, day: number) => {
    const dp = getDatePart(form[field])
    if (!dp) return false
    const d = new Date(dp + 'T00:00')
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
  }

  const isCalendarDayToday = (year: number, month: number, day: number) => {
    const now = new Date()
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day
  }

  const formatCalendarHeader = (year: number, month: number) =>
    `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month))} ${year}`

  const prevCalendarMonth = () =>
    setCalendarNav(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    )

  const nextCalendarMonth = () =>
    setCalendarNav(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    )

  const openCalendarFor = (field: 'startDate' | 'endDate') => {
    if (openDateTimePanel !== field) {
      const dp = getDatePart(form[field])
      if (dp) {
        const d = new Date(dp + 'T00:00')
        setCalendarNav({ year: d.getFullYear(), month: d.getMonth() })
      } else {
        const now = new Date()
        setCalendarNav({ year: now.getFullYear(), month: now.getMonth() })
      }
    }
    setOpenDateTimePanel((p) => (p === field ? null : field))
  }

  // ─────────────────────────────────────────────────────────────────────────

  const clearTicketError = (index: number, key: TicketTypeFieldKey) => {
    setTicketErrors((current) => {
      if (!current[index]?.[key]) return current
      const next = current.map((errors) => ({ ...errors }))
      delete next[index][key]
      return next
    })
  }

  const updateTicketTypeField = (index: number, key: TicketTypeFieldKey, value: string) => {
    setForm((current) => {
      const nextTicketTypes = [...(current.ticketTypes || [])]
      if (!nextTicketTypes[index]) return current

      nextTicketTypes[index] = {
        ...nextTicketTypes[index],
        [key]: key === 'currency' ? normalizeTicketCurrency(value) : value,
      }

      return {
        ...current,
        ticketTypes: nextTicketTypes,
      }
    })
    clearTicketError(index, key)
  }

  const addTicketType = () => {
    setForm((current) => ({
      ...current,
      ticketTypes: [...(current.ticketTypes || []), createEmptyTicketType()],
    }))
    setTicketErrors((current) => [...current, {}])
    setSubmitError(null)
  }

  const removeTicketType = (index: number) => {
    const ticket = form.ticketTypes?.[index]
    if (!ticket) return

    if (ticket.id && !window.confirm('Remove this ticket type?')) {
      return
    }

    setForm((current) => ({
      ...current,
      ticketTypes: (current.ticketTypes || []).filter((_, ticketIndex) => ticketIndex !== index),
    }))
    setTicketErrors((current) => current.filter((_, ticketIndex) => ticketIndex !== index))
  }

  const addPromoCode = () => {
    setPromoCodes((current) => [
      ...current,
      { code: '', discountValue: '', ticketTypeId: '', maxUses: '', minCartAmount: '' },
    ])
  }

  const removePromoCode = (index: number) => {
    setPromoCodes((current) => current.filter((_, i) => i !== index))
  }

  const updatePromoCodeField = (index: number, key: keyof PromoCodeDraft, value: string) => {
    setPromoCodes((current) => {
      const next = [...current]
      if (!next[index]) return current
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  function cleanupObjectUrl(targetField: ImageTargetField) {
    if (targetField === 'coverImage') {
      if (bannerObjectUrlRef.current) {
        URL.revokeObjectURL(bannerObjectUrlRef.current)
        bannerObjectUrlRef.current = null
      }
      return
    }

    if (bottomObjectUrlRef.current) {
      URL.revokeObjectURL(bottomObjectUrlRef.current)
      bottomObjectUrlRef.current = null
    }
  }

  function cleanupCropObjectUrl() {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current)
      cropObjectUrlRef.current = null
    }
  }

  function setLocalPreview(file: File, targetField: ImageTargetField) {
    const objectUrl = URL.createObjectURL(file)
    cleanupObjectUrl(targetField)

    if (targetField === 'coverImage') {
      bannerObjectUrlRef.current = objectUrl
      setBannerPreviewSrc(objectUrl)
      return
    }

    bottomObjectUrlRef.current = objectUrl
    setBottomPreviewSrc(objectUrl)
  }

  useEffect(() => {
    if (mode !== 'create' || initialData?.timezone) return
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (isValidTimeZone(browserTimezone)) {
      setForm((current) => ({ ...current, timezone: browserTimezone }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isCategoryOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCategoryOpen])

  useEffect(() => {
    if (!isUnitOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setIsUnitOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isUnitOpen])

  useEffect(() => {
    if (!openDateTimePanel) return
    function handleClickOutside(e: MouseEvent) {
      if (dateTimePanelRef.current && !dateTimePanelRef.current.contains(e.target as Node)) {
        setOpenDateTimePanel(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDateTimePanel])

  useEffect(() => {
    return () => {
      if (bannerObjectUrlRef.current) {
        URL.revokeObjectURL(bannerObjectUrlRef.current)
      }
      if (bottomObjectUrlRef.current) {
        URL.revokeObjectURL(bottomObjectUrlRef.current)
      }
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current)
      }
      if (cropObjectUrlRef.current) {
        URL.revokeObjectURL(cropObjectUrlRef.current)
      }
      if (speakerCropObjectUrlRef.current) {
        URL.revokeObjectURL(speakerCropObjectUrlRef.current)
      }
      for (const url of speakerPreviewUrlsRef.current.values()) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  function openCropper(file: File, targetField: ImageTargetField) {
    cleanupCropObjectUrl()
    const sourceUrl = URL.createObjectURL(file)
    cropObjectUrlRef.current = sourceUrl

    setCropSession({
      targetField,
      sourceUrl,
      fileName: file.name,
      mimeType: file.type,
    })
    setCropPosition({ x: 0, y: 0 })
    setCropZoom(1)
    setCropPixels(null)
    clearFieldError(targetField)
    setSubmitError(null)
  }

  function closeCropper() {
    setCropSession(null)
    setCropPosition({ x: 0, y: 0 })
    setCropZoom(1)
    setCropPixels(null)
    cleanupCropObjectUrl()
  }

  async function uploadEventImage(file: File, targetField: ImageTargetField) {
    if (!form.id && mode === 'edit') {
      throw new Error('Save the event once before uploading images')
    }

    const uploadRes = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'events',
        entityId: form.id || 'new',
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    })

    if (!uploadRes.ok) {
      throw new Error('Failed to create upload URL')
    }

    const uploadData = await uploadRes.json()
    const uploadUrl = uploadData?.data?.uploadUrl as string | undefined
    const publicUrl = uploadData?.data?.publicUrl as string | undefined

    if (!uploadUrl || !publicUrl) {
      throw new Error('Invalid upload response')
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    if (!putRes.ok) {
      throw new Error('Failed to upload image')
    }

    updateField(targetField, publicUrl)
  }

  function parseTicketValidationErrors(details: unknown, index: number): TicketTypeFieldErrors | null {
    const nextErrors: TicketTypeFieldErrors = {}
    const nameError = parseFirstFieldError(details, 'name')
    const priceError = parseFirstFieldError(details, 'price')
    const currencyError = parseFirstFieldError(details, 'currency')
    const capacityError = parseFirstFieldError(details, 'maxCapacity')

    if (nameError) nextErrors.name = nameError
    if (priceError) nextErrors.price = priceError
    if (currencyError) nextErrors.currency = currencyError
    if (capacityError) nextErrors.capacity = capacityError

    if (Object.keys(nextErrors).length === 0) return null

    setTicketErrors((current) => {
      const next = [...current]
      next[index] = { ...(next[index] || {}), ...nextErrors }
      return next
    })

    return nextErrors
  }

  async function syncTicketTypes(eventId: string, action: 'save' | 'publish') {
    const requireComplete = action === 'publish'
    const ticketTypes = form.ticketTypes || []
    const ticketTypeIdsInForm = new Set(
      ticketTypes.map((ticket) => ticket.id).filter((ticketId): ticketId is string => Boolean(ticketId))
    )
    const nextPersistedIds = new Set(persistedTicketTypeIdsRef.current)
    const idsToDelete = Array.from(persistedTicketTypeIdsRef.current).filter((id) => !ticketTypeIdsInForm.has(id))

    for (const typeId of idsToDelete) {
      const response = await fetch(`/api/events/${eventId}/ticket-types/${typeId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const json = await response.json()
        throw new Error(json?.error || 'Failed to delete ticket type')
      }
      nextPersistedIds.delete(typeId)
    }

    const nextTicketTypes = [...ticketTypes]

    for (let index = 0; index < ticketTypes.length; index += 1) {
      const ticketType = ticketTypes[index]
      const name = ticketType.name.trim()
      const price = parseTicketPrice(ticketType.price)
      const currency = normalizeTicketCurrency(ticketType.currency)
      const capacityRaw = ticketType.capacity.trim()
      const maxCapacity = capacityRaw ? Number(capacityRaw) : null
      const isComplete =
        Boolean(name) &&
        price !== null &&
        price >= 0 &&
        isSupportedCurrency(currency) &&
        (maxCapacity === null || (Number.isInteger(maxCapacity) && maxCapacity > 0))
      const shouldPersist = requireComplete ? true : hasAnyTicketInput(ticketType) && isComplete

      if (!shouldPersist) continue

      const payload = {
        name,
        price,
        currency,
        maxCapacity,
        isVisible: true,
        minPerOrder: 1,
        maxPerOrder: null,
        sortOrder: index,
      }

      const hasExistingTicketType = Boolean(ticketType.id)
      const endpoint = hasExistingTicketType
        ? `/api/events/${eventId}/ticket-types/${ticketType.id}`
        : `/api/events/${eventId}/ticket-types`
      const method = hasExistingTicketType ? 'PATCH' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await response.json()
      if (!response.ok) {
        parseTicketValidationErrors(json?.details, index)
        throw new Error(json?.error || 'Failed to save ticket type')
      }

      if (!hasExistingTicketType && json?.ticketType?.id) {
        nextTicketTypes[index] = {
          ...nextTicketTypes[index],
          id: json.ticketType.id as string,
        }
        nextPersistedIds.add(json.ticketType.id as string)
      } else if (ticketType.id) {
        nextPersistedIds.add(ticketType.id)
      }
    }

    persistedTicketTypeIdsRef.current = nextPersistedIds
    setForm((current) => ({
      ...current,
      ticketTypes: nextTicketTypes,
    }))
    return nextTicketTypes
  }

  async function syncPromoCodes(eventId: string, savedTicketTypes: TicketTypeDraft[]) {
    // Build a map from temp index-based IDs ("ticket-0") to real IDs, for create mode
    const tempToRealIdMap = new Map<string, string>()
    savedTicketTypes.forEach((t, i) => {
      if (t.id) tempToRealIdMap.set(`ticket-${i}`, t.id)
    })

    const promoCodeIdsInForm = new Set(
      promoCodes.map((c) => c.id).filter((id): id is string => Boolean(id))
    )
    const idsToDelete = Array.from(persistedPromoCodeIdsRef.current).filter(
      (id) => !promoCodeIdsInForm.has(id)
    )

    for (const codeId of idsToDelete) {
      const response = await fetch(`/api/events/${eventId}/discount-codes/${codeId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const json = await response.json()
        throw new Error((json?.error as string | undefined) || 'Failed to delete promo code')
      }
    }

    const nextPromoCodes = [...promoCodes]

    for (let index = 0; index < promoCodes.length; index += 1) {
      const promoCode = promoCodes[index]
      if (!promoCode.code.trim() || !promoCode.discountValue.trim() || !promoCode.ticketTypeId) {
        continue
      }

      // Resolve temp ticket type ID to real ID if needed
      const resolvedTicketTypeId = tempToRealIdMap.get(promoCode.ticketTypeId) ?? promoCode.ticketTypeId
      // Skip if ticketTypeId still looks like a temp value (no real ID resolved)
      if (!resolvedTicketTypeId || resolvedTicketTypeId.startsWith('ticket-')) continue

      const discountValue = Number(promoCode.discountValue)
      if (Number.isNaN(discountValue) || discountValue <= 0 || discountValue > 100) continue

      const maxUsesRaw = promoCode.maxUses.trim()
      const maxUses = maxUsesRaw && Number(maxUsesRaw) > 0 ? Number(maxUsesRaw) : null

      const minCartAmountRaw = promoCode.minCartAmount.trim()
      const minCartAmount = minCartAmountRaw ? Number(minCartAmountRaw) : null

      const payload = {
        code: promoCode.code.trim().toUpperCase(),
        discountType: 'PERCENTAGE',
        discountValue,
        maxUses,
        minCartAmount,
        isActive: true,
        ticketTypeIds: [resolvedTicketTypeId],
      }

      const isExisting = Boolean(promoCode.id)
      const endpoint = isExisting
        ? `/api/events/${eventId}/discount-codes/${promoCode.id}`
        : `/api/events/${eventId}/discount-codes`
      const method = isExisting ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error((json?.error as string | undefined) || 'Failed to save promo code')
      }

      if (!isExisting && json?.discountCode?.id) {
        nextPromoCodes[index] = { ...nextPromoCodes[index], id: json.discountCode.id as string }
      }
    }

    persistedPromoCodeIdsRef.current = new Set(
      nextPromoCodes.map((c) => c.id).filter((id): id is string => Boolean(id))
    )
    setPromoCodes(nextPromoCodes)
  }

  function validate(action: 'save' | 'publish') {
    const nextFieldErrors: FieldErrors = {}
    const nextTicketErrors: TicketTypeFieldErrors[] = (form.ticketTypes || []).map(() => ({}))
    const nextGeneralErrors: string[] = []
    const requireComplete = action === 'publish'

    const timezone = isValidTimeZone(form.timezone) ? form.timezone : 'UTC'
    const startUtc = dateTimeLocalInTimeZoneToUtcIso(form.startDate, timezone)
    const endUtc = dateTimeLocalInTimeZoneToUtcIso(form.endDate, timezone)

    if (!form.title?.trim()) nextFieldErrors.title = 'Enter an event title.'

    if (!form.startDate?.trim()) {
      nextFieldErrors.startDate = 'Set start date and time.'
    } else if (!startUtc) {
      nextFieldErrors.startDate = 'Use a valid start date and time.'
    }

    if (!form.endDate?.trim()) {
      nextFieldErrors.endDate = 'Set end date and time.'
    } else if (!endUtc) {
      nextFieldErrors.endDate = 'Use a valid end date and time.'
    }

    if (!form.timezone?.trim()) {
      nextFieldErrors.timezone = 'Select a timezone.'
    } else if (!isValidTimeZone(form.timezone)) {
      nextFieldErrors.timezone = 'Select a valid IANA timezone.'
    }

    if (startUtc && endUtc && new Date(endUtc) <= new Date(startUtc)) {
      nextFieldErrors.endDate = 'End time must be after start time.'
    }

    if (requireComplete && form.locationType !== 'ONLINE') {
      if (!form.venue?.trim()) nextFieldErrors.venue = 'Enter venue.'
      if (!form.address?.trim()) nextFieldErrors.address = 'Enter address.'
      if (!form.city?.trim()) nextFieldErrors.city = 'Enter city.'
      if (!form.country?.trim()) nextFieldErrors.country = 'Enter country.'
    }

    if (
      requireComplete &&
      (form.locationType === 'ONLINE' || form.locationType === 'HYBRID') &&
      !form.onlineUrl?.trim()
    ) {
      nextFieldErrors.onlineUrl = 'Enter an online URL.'
    }

    if (requireComplete && !form.description?.trim()) {
      nextFieldErrors.description = 'Add an event description.'
    }

    const ticketTypes = form.ticketTypes || []
    const seenTicketNames = new Map<string, number[]>()
    let hasPublishableTicketType = false

    for (let index = 0; index < ticketTypes.length; index += 1) {
      const ticket = ticketTypes[index]
      const rowErrors = nextTicketErrors[index]
      const name = ticket.name.trim()
      const price = parseTicketPrice(ticket.price)
      const currency = normalizeTicketCurrency(ticket.currency)
      const capacityRaw = ticket.capacity.trim()
      const maxCapacity = capacityRaw ? Number(capacityRaw) : null
      const hasInput = hasAnyTicketInput(ticket)

      if (!requireComplete && !hasInput) {
        continue
      }

      if (!name) rowErrors.name = 'Enter ticket name.'
      if (price === null || price < 0) rowErrors.price = 'Enter a valid price (0 or greater).'
      if (!isSupportedCurrency(currency)) rowErrors.currency = 'Select a supported currency.'
      if (maxCapacity !== null && (!Number.isInteger(maxCapacity) || maxCapacity < 1)) {
        rowErrors.capacity = 'Enter a whole number greater than 0 or leave empty.'
      }

      if (name) {
        const normalizedName = name.toLowerCase()
        const existingIndexes = seenTicketNames.get(normalizedName) || []
        seenTicketNames.set(normalizedName, [...existingIndexes, index])
      }

      if (Object.keys(rowErrors).length === 0 && hasInput) {
        hasPublishableTicketType = true
      }
    }

    for (const duplicateIndexes of seenTicketNames.values()) {
      if (duplicateIndexes.length < 2) continue
      for (const index of duplicateIndexes) {
        nextTicketErrors[index].name = 'Ticket names must be unique.'
      }
    }

    if (requireComplete && ticketTypes.length < 1) {
      nextGeneralErrors.push('Add at least one ticket type before publishing.')
    }

    if (requireComplete && ticketTypes.length > 0 && !hasPublishableTicketType) {
      nextGeneralErrors.push('Fix ticket type details before publishing.')
    }

    const hasTicketErrors = nextTicketErrors.some((row) => Object.keys(row).length > 0)

    if (action === 'publish' && Object.keys(nextFieldErrors).length > 0) {
      nextGeneralErrors.push('Cannot publish yet. Fix the highlighted fields.')
    }

    if (action === 'save' && (Object.keys(nextFieldErrors).length > 0 || hasTicketErrors)) {
      nextGeneralErrors.push('Please fix the highlighted fields before saving.')
    }

    if (action === 'publish' && hasTicketErrors) {
      nextGeneralErrors.push('Cannot publish yet. Fix ticket type fields.')
    }

    return {
      fieldErrors: nextFieldErrors,
      ticketErrors: nextTicketErrors,
      generalErrors: nextGeneralErrors,
      startUtc,
      endUtc,
    }
  }

  async function ensureCropSourceFile(targetField: ImageTargetField, fallbackImageSrc: string | null) {
    const existingFile = editableImageFiles[targetField] || croppedImageFiles[targetField] || originalImageFiles[targetField]
    if (existingFile) return existingFile
    if (!fallbackImageSrc) return null

    const response = await fetch(fallbackImageSrc)
    if (!response.ok) {
      throw new Error('Failed to load existing image for cropping')
    }

    const blob = await response.blob()
    if (!blob.size) {
      throw new Error('Image file is empty')
    }

    const file = new File([blob], createFileNameFromMimeType(targetField, blob.type || 'image/jpeg'), {
      type: blob.type || 'image/jpeg',
    })

    setOriginalImageFiles((current) => ({ ...current, [targetField]: file }))
    setEditableImageFiles((current) => ({ ...current, [targetField]: file }))
    return file
  }

  function isUploadingImage(targetField: ImageTargetField) {
    return targetField === 'coverImage' ? isUploadingBanner : isUploadingBottom
  }

  async function handleImageFileSelected(file: File, targetField: ImageTargetField) {
    setActiveDropTarget((current) => (current === targetField ? null : current))

    if (!allowedImageMimeTypes.has(file.type)) {
      setFieldErrors((current) => ({
        ...current,
        [targetField]: 'Please select a JPG, PNG, WEBP, or GIF image.',
      }))
      setToast({ message: 'Unsupported image format', tone: 'error' })
      return
    }

    setOriginalImageFiles((current) => ({ ...current, [targetField]: file }))
    setCroppedImageFiles((current) => ({ ...current, [targetField]: null }))
    setEditableImageFiles((current) => ({ ...current, [targetField]: file }))
    openCropper(file, targetField)
  }

  async function onImageSelected(event: ChangeEvent<HTMLInputElement>, targetField: ImageTargetField) {
    const file = event.target.files?.[0]
    if (!file) return
    await handleImageFileSelected(file, targetField)
    event.target.value = ''
  }

  function onImageDragEnter(event: DragEvent<HTMLElement>, targetField: ImageTargetField) {
    event.preventDefault()
    if (isUploadingImage(targetField)) return
    setActiveDropTarget(targetField)
  }

  function onImageDragOver(event: DragEvent<HTMLElement>, targetField: ImageTargetField) {
    event.preventDefault()
    if (isUploadingImage(targetField)) return
    event.dataTransfer.dropEffect = 'copy'
    if (activeDropTarget !== targetField) {
      setActiveDropTarget(targetField)
    }
  }

  function onImageDragLeave(event: DragEvent<HTMLElement>, targetField: ImageTargetField) {
    event.preventDefault()
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }
    setActiveDropTarget((current) => (current === targetField ? null : current))
  }

  async function onImageDrop(event: DragEvent<HTMLElement>, targetField: ImageTargetField) {
    event.preventDefault()
    setActiveDropTarget((current) => (current === targetField ? null : current))
    if (isUploadingImage(targetField)) return
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await handleImageFileSelected(file, targetField)
  }

  async function applyCrop() {
    if (!cropSession || !cropPixels) {
      setFieldErrors((current) => ({
        ...current,
        [cropSession?.targetField || 'coverImage']: 'Adjust the crop area before applying.',
      }))
      return
    }

    setIsApplyingCrop(true)
    if (cropSession.targetField === 'coverImage') {
      setIsUploadingBanner(true)
    } else {
      setIsUploadingBottom(true)
    }

    try {
      const croppedFile = await cropImageToFile({
        sourceUrl: cropSession.sourceUrl,
        cropPixels,
        fileName: cropSession.fileName,
        mimeType: cropSession.mimeType,
      })

      setCroppedImageFiles((current) => ({ ...current, [cropSession.targetField]: croppedFile }))
      setEditableImageFiles((current) => ({ ...current, [cropSession.targetField]: croppedFile }))
      setLocalPreview(croppedFile, cropSession.targetField)
      await uploadEventImage(croppedFile, cropSession.targetField)
      setImageVersion((version) => version + 1)
      closeCropper()
    } catch (cropError) {
      const message = cropError instanceof Error ? cropError.message : 'Image update failed'
      setFieldErrors((current) => ({ ...current, [cropSession.targetField]: message }))
      setToast({ message, tone: 'error' })
    } finally {
      setIsApplyingCrop(false)
      if (cropSession.targetField === 'coverImage') {
        setIsUploadingBanner(false)
      } else {
        setIsUploadingBottom(false)
      }
    }
  }

  async function openExistingCrop(targetField: ImageTargetField, fallbackImageSrc: string | null) {
    setIsPreparingCrop(targetField)

    try {
      const file = await ensureCropSourceFile(targetField, fallbackImageSrc)
      if (!file) return
      openCropper(file, targetField)
    } catch (cropError) {
      const message = cropError instanceof Error ? cropError.message : 'Unable to open crop editor'
      setFieldErrors((current) => ({ ...current, [targetField]: message }))
      setToast({ message, tone: 'error' })
    } finally {
      setIsPreparingCrop(null)
    }
  }

  function deleteUploadedImage(targetField: ImageTargetField) {
    cleanupObjectUrl(targetField)
    if (targetField === 'coverImage') {
      setBannerPreviewSrc(null)
    } else {
      setBottomPreviewSrc(null)
    }
    setOriginalImageFiles((current) => ({ ...current, [targetField]: null }))
    setCroppedImageFiles((current) => ({ ...current, [targetField]: null }))
    setEditableImageFiles((current) => ({ ...current, [targetField]: null }))
    updateField(targetField, '')
    if (cropSession?.targetField === targetField) {
      closeCropper()
    }
  }

  async function resetImageToOriginal(targetField: ImageTargetField) {
    const originalFile = originalImageFiles[targetField]
    if (!originalFile) return

    if (targetField === 'coverImage') {
      setIsUploadingBanner(true)
    } else {
      setIsUploadingBottom(true)
    }

    try {
      setEditableImageFiles((current) => ({ ...current, [targetField]: originalFile }))
      setLocalPreview(originalFile, targetField)
      await uploadEventImage(originalFile, targetField)
      setCroppedImageFiles((current) => ({ ...current, [targetField]: null }))
      setImageVersion((version) => version + 1)
      closeCropper()
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : 'Failed to reset image'
      setFieldErrors((current) => ({ ...current, [targetField]: message }))
      setToast({ message, tone: 'error' })
    } finally {
      if (targetField === 'coverImage') {
        setIsUploadingBanner(false)
      } else {
        setIsUploadingBottom(false)
      }
    }
  }

  async function uploadEventVideo(file: File) {
    if (!form.id && mode === 'edit') {
      throw new Error('Save the event once before uploading videos')
    }

    const uploadRes = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'events',
        entityId: form.id || 'new',
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    })

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json().catch(() => null)
      if (errorData?.details?.size) {
        throw new Error('Video file is too large. Maximum size is 50 MB.')
      }
      throw new Error((errorData?.error as string | undefined) || 'Failed to create upload URL')
    }

    const uploadData = await uploadRes.json()
    const uploadUrl = uploadData?.data?.uploadUrl as string | undefined
    const publicUrl = uploadData?.data?.publicUrl as string | undefined

    if (!uploadUrl || !publicUrl) throw new Error('Invalid upload response')

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })

    if (!putRes.ok) throw new Error('Failed to upload video')

    updateField('videoUrl', publicUrl)
  }

  async function onVideoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    if (!allowedVideoMimeTypes.has(file.type)) {
      setFieldErrors((current) => ({ ...current, videoUrl: 'Please select an MP4, WebM, or MOV video.' }))
      setToast({ message: 'Unsupported video format', tone: 'error' })
      return
    }

    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(file)
    videoObjectUrlRef.current = objectUrl
    setVideoPreviewSrc(objectUrl)

    setIsUploadingVideo(true)
    try {
      await uploadEventVideo(file)
    } catch (videoError) {
      const message = videoError instanceof Error ? videoError.message : 'Video upload failed'
      setFieldErrors((current) => ({ ...current, videoUrl: message }))
      setToast({ message, tone: 'error' })
    } finally {
      setIsUploadingVideo(false)
    }
  }

  function deleteVideo() {
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
      videoObjectUrlRef.current = null
    }
    setVideoPreviewSrc(null)
    updateField('videoUrl', '')
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.videoUrl
      return next
    })
  }

  function addSpeakerDraft() {
    setSpeakerDrafts((current) => [
      ...current,
      {
        key: `speaker-${Date.now()}-${Math.random()}`,
        name: '',
        title: '',
        organization: '',
        originalFile: null,
        croppedFile: null,
        previewUrl: null,
        publicUrl: '',
        isUploading: false,
      },
    ])
  }

  function removeSpeakerDraft(key: string) {
    setSpeakerDrafts((current) => {
      const draft = current.find((d) => d.key === key)
      if (draft?.previewUrl) {
        URL.revokeObjectURL(draft.previewUrl)
        speakerPreviewUrlsRef.current.delete(draft.key)
      }
      return current.filter((d) => d.key !== key)
    })
    if (speakerCropSession?.speakerKey === key) closeSpeakerCropper()
  }

  function updateSpeakerDraft(key: string, field: 'name' | 'title' | 'organization', value: string) {
    setSpeakerDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, [field]: value } : draft))
    )
  }

  function triggerSpeakerImageSelect(key: string) {
    speakerImageTargetKeyRef.current = key
    speakerImageInputRef.current?.click()
  }

  async function onSpeakerImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const targetKey = speakerImageTargetKeyRef.current
    if (!file || !targetKey) return
    if (!allowedImageMimeTypes.has(file.type)) {
      setToast({ message: 'Unsupported image format', tone: 'error' })
      return
    }
    setSpeakerDrafts((current) =>
      current.map((d) => (d.key === targetKey ? { ...d, originalFile: file } : d))
    )
    openSpeakerCropper(file, targetKey)
  }

  function openSpeakerCropper(file: File, speakerKey: string) {
    if (speakerCropObjectUrlRef.current) {
      URL.revokeObjectURL(speakerCropObjectUrlRef.current)
    }
    const sourceUrl = URL.createObjectURL(file)
    speakerCropObjectUrlRef.current = sourceUrl
    setSpeakerCropSession({ speakerKey, sourceUrl, fileName: file.name, mimeType: file.type })
    setSpeakerCropPosition({ x: 0, y: 0 })
    setSpeakerCropZoom(1)
    setSpeakerCropPixels(null)
  }

  function closeSpeakerCropper() {
    setSpeakerCropSession(null)
    setSpeakerCropPosition({ x: 0, y: 0 })
    setSpeakerCropZoom(1)
    setSpeakerCropPixels(null)
    if (speakerCropObjectUrlRef.current) {
      URL.revokeObjectURL(speakerCropObjectUrlRef.current)
      speakerCropObjectUrlRef.current = null
    }
  }

  function openSpeakerReCrop(key: string) {
    const draft = speakerDrafts.find((d) => d.key === key)
    if (!draft) return
    const file = draft.originalFile || draft.croppedFile
    if (!file) return
    openSpeakerCropper(file, key)
  }

  function deleteSpeakerImage(key: string) {
    setSpeakerDrafts((current) =>
      current.map((draft) => {
        if (draft.key !== key) return draft
        if (draft.previewUrl) {
          URL.revokeObjectURL(draft.previewUrl)
          speakerPreviewUrlsRef.current.delete(draft.key)
        }
        return { ...draft, originalFile: null, croppedFile: null, previewUrl: null, publicUrl: '' }
      })
    )
    if (speakerCropSession?.speakerKey === key) closeSpeakerCropper()
  }

  async function uploadSpeakerImage(file: File): Promise<string> {
    const uploadRes = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: 'speakers',
        entityId: form.id || 'new',
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    })
    if (!uploadRes.ok) throw new Error('Failed to create upload URL')
    const uploadData = await uploadRes.json()
    const uploadUrl = uploadData?.data?.uploadUrl as string | undefined
    const publicUrl = uploadData?.data?.publicUrl as string | undefined
    if (!uploadUrl || !publicUrl) throw new Error('Invalid upload response')
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!putRes.ok) throw new Error('Failed to upload image')
    return publicUrl
  }

  async function applySpeakerCrop() {
    if (!speakerCropSession || !speakerCropPixels) return
    const { speakerKey, sourceUrl, fileName, mimeType } = speakerCropSession
    setIsApplyingSpeakerCrop(true)
    setSpeakerDrafts((current) =>
      current.map((d) => (d.key === speakerKey ? { ...d, isUploading: true } : d))
    )
    try {
      const croppedFile = await cropImageToFile({ sourceUrl, cropPixels: speakerCropPixels, fileName, mimeType })
      const newPreviewUrl = URL.createObjectURL(croppedFile)
      const publicUrl = await uploadSpeakerImage(croppedFile)
      setSpeakerDrafts((current) =>
        current.map((draft) => {
          if (draft.key !== speakerKey) return draft
          if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl)
          speakerPreviewUrlsRef.current.set(draft.key, newPreviewUrl)
          return { ...draft, croppedFile, previewUrl: newPreviewUrl, publicUrl, isUploading: false }
        })
      )
      closeSpeakerCropper()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image upload failed'
      setToast({ message, tone: 'error' })
      setSpeakerDrafts((current) =>
        current.map((d) => (d.key === speakerKey ? { ...d, isUploading: false } : d))
      )
    } finally {
      setIsApplyingSpeakerCrop(false)
    }
  }

  async function submit(action: 'save' | 'publish') {
    setSubmitError(null)
    setGeneralErrors([])

    const validationResult = validate(action)
    setFieldErrors(validationResult.fieldErrors)
    setTicketErrors(validationResult.ticketErrors)

    const hasTicketErrors = validationResult.ticketErrors.some((row) => Object.keys(row).length > 0)
    const hasFieldErrors = Object.keys(validationResult.fieldErrors).length > 0
    const shouldBlockSubmit = hasFieldErrors || hasTicketErrors || (action === 'publish' && validationResult.generalErrors.length > 0)

    if (shouldBlockSubmit) {
      setGeneralErrors(validationResult.generalErrors)
      focusFirstInvalidField(validationResult.fieldErrors, validationResult.ticketErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const safeTimezone = isValidTimeZone(form.timezone) ? form.timezone : 'UTC'
      const startUtc = validationResult.startUtc
      const endUtc = validationResult.endUtc

      if (!startUtc || !endUtc) {
        throw new Error('Start and end dates are required')
      }

      const validSpeakerDrafts = speakerDrafts.filter((d) => d.name.trim())
      const payload = {
        ...form,
        timezone: safeTimezone,
        startDate: startUtc,
        endDate: endUtc,
        description: form.description || '',
        descriptionHtml: undefined,
        onlineUrl: form.onlineUrl || null,
        coverImage: form.coverImage || null,
        bottomImage: form.bottomImage || null,
        videoUrl: form.videoUrl || null,
        speakerNames: validSpeakerDrafts.map((d) => d.name.trim()),
        organizerNames: validSpeakerDrafts.map((d) => d.title),
        sponsorNames: validSpeakerDrafts.map((d) => d.organization),
        speakerPhotos: validSpeakerDrafts.map((d) => d.publicUrl),
        categoryIds: form.categoryIds,
        ticketTypes: undefined,
        ticketTypeId: undefined,
        ticketTypeName: undefined,
        ticketPrice: undefined,
        ticketCurrency: undefined,
        ticketCapacity: undefined,
        status: undefined,
      }

      const endpoint = mode === 'create' ? '/api/events' : `/api/events/${form.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const eventRes = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const eventJson = await eventRes.json()
      if (!eventRes.ok) {
        const apiFieldErrors = parseApiValidationErrors(eventJson?.details)
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors)
          focusFirstInvalidField(apiFieldErrors, [])
        }

        throw new Error(eventJson?.error || 'Failed to save event')
      }

      const eventId = eventJson?.data?.id || form.id
      const eventSlug = (eventJson?.data?.slug as string | undefined) || form.slug

      if (eventId) {
        const savedTicketTypes = await syncTicketTypes(eventId, action)
        await syncPromoCodes(eventId, savedTicketTypes ?? [])
      }

      if (action === 'publish' && eventId) {
        const publishRes = await fetch(`/api/events/${eventId}/publish`, {
          method: 'POST',
        })

        const publishJson = await publishRes.json()
        if (!publishRes.ok) {
          const publishFieldErrors = parsePublishIssueFieldErrors(publishJson?.details)
          if (Object.keys(publishFieldErrors).length > 0) {
            setFieldErrors((current) => ({ ...current, ...publishFieldErrors }))
            focusFirstInvalidField(publishFieldErrors, [])
          }
          throw new Error(publishJson?.error || 'Failed to publish event')
        }
      }

      cleanupObjectUrl('coverImage')
      cleanupObjectUrl('bottomImage')

      if (mode === 'create' && eventSlug) {
        router.push(`/events/${eventSlug}?notice=created`)
        return
      }

      if (mode === 'edit') {
        setToast({ message: action === 'publish' ? 'Event published' : 'Event updated', tone: 'success' })
        router.refresh()
        return
      }

      if (eventId) {
        router.push(`/dashboard/events/${eventId}/edit`)
      } else {
        router.refresh()
      }
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : 'Failed to save event'
      setSubmitError(message)
      setToast({ message, tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function onTimezoneChanged(nextTimezone: string) {
    const fallbackTimezone = isValidTimeZone(nextTimezone) ? nextTimezone : 'UTC'

    setForm((current) => ({
      ...current,
      timezone: fallbackTimezone,
      startDate: convertDateTimeLocalBetweenTimeZones(current.startDate, current.timezone || 'UTC', fallbackTimezone),
      endDate: convertDateTimeLocalBetweenTimeZones(current.endDate, current.timezone || 'UTC', fallbackTimezone),
    }))

    clearFieldError('timezone')
    clearFieldError('startDate')
    clearFieldError('endDate')
  }

  function onCancel() {
    const isDirty =
      buildSnapshot(form) !== initialSnapshotRef.current ||
      Boolean(croppedImageFiles.coverImage) ||
      Boolean(croppedImageFiles.bottomImage)

    if (isDirty && !window.confirm('Discard unsaved changes?')) {
      return
    }

    if (mode === 'create') {
      router.push('/dashboard/events')
      return
    }

    if (form.slug) {
      router.push(`/events/${form.slug}`)
      return
    }

    router.push('/dashboard/events')
  }

  const remoteBannerPreviewSrc =
    mode === 'edit' && form.id && form.coverImage
      ? `/api/events/${encodeURIComponent(form.id)}/image?slot=cover&v=${imageVersion}`
      : null
  const remoteBottomPreviewSrc =
    mode === 'edit' && form.id && form.bottomImage
      ? `/api/events/${encodeURIComponent(form.id)}/image?slot=bottom&v=${imageVersion}`
      : null
  const bannerImageSrc = bannerPreviewSrc || remoteBannerPreviewSrc || form.coverImage || null
  const bottomImageSrc = bottomPreviewSrc || remoteBottomPreviewSrc || form.bottomImage || null
  const videoSrc = videoPreviewSrc || form.videoUrl || null
  const isBannerDropActive = activeDropTarget === 'coverImage'
  const isBottomDropActive = activeDropTarget === 'bottomImage'

  const canEditCoverImage = Boolean(bannerImageSrc || editableImageFiles.coverImage || originalImageFiles.coverImage)
  const canEditBottomImage = Boolean(bottomImageSrc || editableImageFiles.bottomImage || originalImageFiles.bottomImage)
  const isPublishedEvent = mode === 'edit' && form.status === 'PUBLISHED'

  return (
    <div className="space-y-8 px-1 sm:px-0">
      <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
        {mode === 'create' ? 'Create Event Info' : 'Edit Event Info'}
      </h2>

      {generalErrors.length > 0 ? (
        <div className="sticky top-4 z-10 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {generalErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      <input
        ref={bannerInputRef}
        id="coverImageUpload"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => onImageSelected(event, 'coverImage')}
        className="hidden"
        disabled={isUploadingBanner}
      />
      <input
        ref={speakerImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => void onSpeakerImageSelected(event)}
        className="hidden"
      />
      <section className="space-y-4 border-b border-[#d1d5dc] pb-4">
        <h3 className="text-2xl font-bold text-black">Header Image</h3>

        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={isUploadingBanner}
          onDragEnter={(event) => onImageDragEnter(event, 'coverImage')}
          onDragOver={(event) => onImageDragOver(event, 'coverImage')}
          onDragLeave={(event) => onImageDragLeave(event, 'coverImage')}
          onDrop={(event) => {
            void onImageDrop(event, 'coverImage')
          }}
          aria-label={bannerImageSrc ? 'Change banner image' : 'Add banner image'}
          className={`group relative w-full cursor-pointer overflow-hidden rounded-[14px] border-[1.6px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8bd9] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
            isBannerDropActive
              ? 'border-[#5c8bd9] bg-blue-50/30'
              : bannerImageSrc
                ? 'border-[#d1d5dc]'
                : 'border-[#d1d5dc] bg-white hover:border-[#5c8bd9] hover:bg-blue-50/10'
          }`}
        >
          {bannerImageSrc ? (
            <div className="relative aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerImageSrc}
                alt="Event banner"
                className="h-full w-full object-cover transition duration-200 group-hover:brightness-90 group-focus-visible:brightness-90"
              />
              <div
                className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-200 ${
                  isUploadingBanner || isBannerDropActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                }`}
              >
                <span className="rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
                  {isUploadingBanner ? 'Uploading...' : isBannerDropActive ? 'Drop image' : 'Click to change image'}
                </span>
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center gap-[6px] py-[33px] ${isBannerDropActive ? 'bg-blue-50/30' : ''}`}>
              <Upload className="h-12 w-12 text-[#5c8bd9]" aria-hidden="true" />
              <p className="text-base font-medium text-[#4a5565]">
                {isUploadingBanner ? 'Uploading...' : isBannerDropActive ? 'Drop banner image' : 'Click to upload header image'}
              </p>
            </div>
          )}
        </button>

        {canEditCoverImage || croppedImageFiles.coverImage ? (
          <div className="flex flex-wrap gap-3">
            {canEditCoverImage ? (
              <Button
                type="button"
                variant="outline"
                isLoading={isPreparingCrop === 'coverImage'}
                onClick={() => {
                  void openExistingCrop('coverImage', bannerImageSrc)
                }}
              >
                Edit / Crop banner
              </Button>
            ) : null}
            {croppedImageFiles.coverImage ? (
              <Button type="button" variant="outline" isLoading={isUploadingBanner} onClick={() => void resetImageToOriginal('coverImage')}>
                Undo crop
              </Button>
            ) : null}
            {canEditCoverImage ? (
              <Button type="button" variant="outline" onClick={() => deleteUploadedImage('coverImage')}>
                Delete image
              </Button>
            ) : null}
          </div>
        ) : null}
        {fieldErrors.coverImage ? <p className="text-sm text-red-600">{fieldErrors.coverImage}</p> : null}
      </section>

      <section className="space-y-4 border-b border-[#d1d5dc] pb-4">
        <h3 className="text-2xl font-bold text-black">Event Information</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title" required className="text-base font-semibold text-black">Event Title</Label>
            <Input
              id="title"
              placeholder="Enter event title"
              value={form.title}
              error={fieldErrors.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="h-10 rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 py-2 text-sm placeholder:text-[#99a1af] focus:ring-[#5c8bd9]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sponsorNames" required className="text-base font-semibold text-black">Organization</Label>
            <Input
              id="sponsorNames"
              placeholder="Organization name"
              value={form.sponsorNames || ''}
              onChange={(e) => updateField('sponsorNames', e.target.value)}
              className="h-10 rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 py-2 text-sm placeholder:text-[#99a1af] focus:ring-[#5c8bd9]"
            />
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-col gap-2" ref={categoryDropdownRef}>
            <Label required className="text-base font-semibold text-black">Category</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryOpen((open) => !open)}
                className="flex h-10 w-full items-center justify-between rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 text-sm hover:border-[#5c8bd9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8bd9]"
              >
                <span className={form.categoryIds?.length ? 'text-gray-900' : 'text-[#99a1af]'}>
                  {form.categoryIds?.length
                    ? categories.filter((c) => form.categoryIds!.includes(c.id)).map((c) => c.name).join(', ')
                    : 'Select a category'}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
              {isCategoryOpen ? (
                <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[220px] rounded-2xl bg-white py-2 shadow-2xl max-h-72 overflow-y-auto">
                  {categories.map((cat) => {
                    const selected = form.categoryIds?.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const current = form.categoryIds || []
                          updateField(
                            'categoryIds',
                            selected ? current.filter((id) => id !== cat.id) : [...current, cat.id],
                          )
                        }}
                        className={`w-full text-left px-4 py-3 text-[14px] transition-colors hover:bg-gray-50 ${selected ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="description" required className="text-base font-semibold text-black">Description</Label>
          <textarea
            id="description"
            className="min-h-[169.6px] w-full resize-y rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#99a1af] focus:outline-none focus:ring-2 focus:ring-[#5c8bd9] focus:border-transparent"
            placeholder="Describe your event..."
            value={form.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
          />
          {fieldErrors.description ? <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p> : null}
        </div>
      </section>

      {/* ── Date & Time ──────────────────────────────────────────────────────── */}
      <section className="space-y-4 border-b border-[#d1d5dc] pb-4" ref={dateTimePanelRef}>
        <h3 className="text-2xl font-bold text-black">Date &amp; Time</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Start Date */}
          <div className="flex flex-col gap-2">
            <Label required className="text-base font-semibold text-black">Start Date</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => openCalendarFor('startDate')}
                className="flex h-10 w-full items-center justify-between rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 text-sm hover:border-[#5c8bd9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5c8bd9]"
              >
                <span className={getDatePart(form.startDate) ? 'font-medium text-gray-900' : 'text-[#828283]'}>
                  {getDatePart(form.startDate)
                    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(getDatePart(form.startDate) + 'T00:00'))
                    : 'Select start date'}
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-500" aria-hidden>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
              {openDateTimePanel === 'startDate' && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[320px] rounded-2xl bg-white p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <button type="button" onClick={prevCalendarMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Previous month">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <span className="text-[15px] font-semibold text-gray-900">{formatCalendarHeader(calendarNav.year, calendarNav.month)}</span>
                    <button type="button" onClick={nextCalendarMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Next month">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7">
                    {WEEKDAY_LABELS.map((d) => (
                      <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {buildCalendarCells(calendarNav.year, calendarNav.month).map((day, i) => (
                      <div key={i} className="flex justify-center">
                        {day ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateDatePart('startDate', `${calendarNav.year}-${String(calendarNav.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
                              setOpenDateTimePanel(null)
                            }}
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-medium transition-colors ${
                              isDatePickerDaySelected('startDate', calendarNav.year, calendarNav.month, day)
                                ? 'bg-blue-600 text-white'
                                : isCalendarDayToday(calendarNav.year, calendarNav.month, day)
                                  ? 'border-2 border-blue-500 text-blue-600 hover:bg-blue-50'
                                  : 'text-gray-800 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        ) : (
                          <div className="h-10 w-10" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {fieldErrors.startDate ? <p className="text-sm text-red-600">{fieldErrors.startDate}</p> : null}
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-2">
            <Label required className="text-base font-semibold text-black">End Date</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => openCalendarFor('endDate')}
                className="flex h-10 w-full items-center justify-between rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 text-sm hover:border-[#5c8bd9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5c8bd9]"
              >
                <span className={getDatePart(form.endDate) ? 'font-medium text-gray-900' : 'text-[#828283]'}>
                  {getDatePart(form.endDate)
                    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(getDatePart(form.endDate) + 'T00:00'))
                    : 'Select end date'}
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-500" aria-hidden>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
              {openDateTimePanel === 'endDate' && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-[320px] rounded-2xl bg-white p-5 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <button type="button" onClick={prevCalendarMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Previous month">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <span className="text-[15px] font-semibold text-gray-900">{formatCalendarHeader(calendarNav.year, calendarNav.month)}</span>
                    <button type="button" onClick={nextCalendarMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Next month">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7">
                    {WEEKDAY_LABELS.map((d) => (
                      <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {buildCalendarCells(calendarNav.year, calendarNav.month).map((day, i) => (
                      <div key={i} className="flex justify-center">
                        {day ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateDatePart('endDate', `${calendarNav.year}-${String(calendarNav.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
                              setOpenDateTimePanel(null)
                            }}
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-medium transition-colors ${
                              isDatePickerDaySelected('endDate', calendarNav.year, calendarNav.month, day)
                                ? 'bg-blue-600 text-white'
                                : isCalendarDayToday(calendarNav.year, calendarNav.month, day)
                                  ? 'border-2 border-blue-500 text-blue-600 hover:bg-blue-50'
                                  : 'text-gray-800 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        ) : (
                          <div className="h-10 w-10" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {fieldErrors.endDate ? <p className="text-sm text-red-600">{fieldErrors.endDate}</p> : null}
          </div>

          {/* Start Time */}
          <div className="flex flex-col gap-2">
            <Label required className="text-base font-semibold text-black">Start Time</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDateTimePanel((p) => (p === 'startTime' ? null : 'startTime'))}
                className="flex h-10 w-full items-center justify-between rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 text-sm hover:border-[#5c8bd9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5c8bd9]"
              >
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-500" aria-hidden>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className={getTimePart(form.startDate) ? 'font-medium text-gray-900' : 'text-[#828283]'}>
                    {getTimePart(form.startDate) || '--:-- (24-hour format)'}
                  </span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openDateTimePanel === 'startTime' && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-50 flex w-[160px] overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <div className="flex-1 overflow-y-auto border-r border-gray-100" style={{ maxHeight: '200px' }}>
                    <p className="sticky top-0 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Hr</p>
                    {HOUR_OPTIONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => updateHourPart('startDate', h)}
                        className={`w-full px-3 py-2 text-center text-[14px] transition-colors hover:bg-gray-50 ${
                          getTimePart(form.startDate).split(':')[0] === h ? 'font-semibold text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: '200px' }}>
                    <p className="sticky top-0 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Min</p>
                    {MINUTE_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { updateMinutePart('startDate', m); setOpenDateTimePanel(null) }}
                        className={`w-full px-3 py-2 text-center text-[14px] transition-colors hover:bg-gray-50 ${
                          getTimePart(form.startDate).split(':')[1] === m ? 'font-semibold text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* End Time */}
          <div className="flex flex-col gap-2">
            <Label required className="text-base font-semibold text-black">End Time</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDateTimePanel((p) => (p === 'endTime' ? null : 'endTime'))}
                className="flex h-10 w-full items-center justify-between rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 text-sm hover:border-[#5c8bd9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#5c8bd9]"
              >
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-500" aria-hidden>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className={getTimePart(form.endDate) ? 'font-medium text-gray-900' : 'text-[#828283]'}>
                    {getTimePart(form.endDate) || '--:-- (24-hour format)'}
                  </span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openDateTimePanel === 'endTime' && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-50 flex w-[160px] overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <div className="flex-1 overflow-y-auto border-r border-gray-100" style={{ maxHeight: '200px' }}>
                    <p className="sticky top-0 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Hr</p>
                    {HOUR_OPTIONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => updateHourPart('endDate', h)}
                        className={`w-full px-3 py-2 text-center text-[14px] transition-colors hover:bg-gray-50 ${
                          getTimePart(form.endDate).split(':')[0] === h ? 'font-semibold text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: '200px' }}>
                    <p className="sticky top-0 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Min</p>
                    {MINUTE_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { updateMinutePart('endDate', m); setOpenDateTimePanel(null) }}
                        className={`w-full px-3 py-2 text-center text-[14px] transition-colors hover:bg-gray-50 ${
                          getTimePart(form.endDate).split(':')[1] === m ? 'font-semibold text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Time Zone */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone" required className="text-base font-semibold text-black">Time Zone</Label>
            <div className="relative">
              <select
                id="timezone"
                className="h-10 w-full appearance-none rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5c8bd9]"
                value={form.timezone}
                onChange={(e) => onTimezoneChanged(e.target.value)}
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {fieldErrors.timezone ? <p className="mt-1 text-sm text-red-600">{fieldErrors.timezone}</p> : null}
          </div>

        </div>
      </section>

      {/* ── Location ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4 border-b border-[#d1d5dc] pb-4">
        <h3 className="text-2xl font-bold text-black">Location</h3>

        {/* Location Type toggle buttons */}
        <div className="flex flex-col gap-2">
          <label className="text-base font-semibold text-[#364153]">
            Location Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            {(['PHYSICAL', 'ONLINE', 'HYBRID'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateField('locationType', type)}
                className={`h-12 rounded-[10px] px-5 text-base font-semibold capitalize transition-colors ${
                  form.locationType === type
                    ? 'bg-[#5c8bd9] text-white'
                    : 'bg-[#e5e7eb] text-[#364153]'
                }`}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {form.locationType !== 'ONLINE' ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="venue" required className="text-base font-semibold text-black">Venue</Label>
                <Input
                  id="venue"
                  placeholder="Venue name"
                  value={form.venue || ''}
                  error={fieldErrors.venue}
                  onChange={(e) => updateField('venue', e.target.value)}
                  className="h-[40px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="address" required className="text-base font-semibold text-black">Address</Label>
                <Input
                  id="address"
                  placeholder="Street address"
                  value={form.address || ''}
                  error={fieldErrors.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="h-[40px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="city" required className="text-base font-semibold text-black">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={form.city || ''}
                  error={fieldErrors.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className="h-[40px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="state" className="text-base font-semibold text-black">State/Province</Label>
                <Input
                  id="state"
                  placeholder="State"
                  value={form.state || ''}
                  onChange={(e) => updateField('state', e.target.value)}
                  className="h-[40px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="country" required className="text-base font-semibold text-black">Country</Label>
                <Input
                  id="country"
                  placeholder="Country"
                  value={form.country || ''}
                  error={fieldErrors.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="h-[40px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="postalCode" className="text-base font-semibold text-black">Postal Code</Label>
                <Input
                  id="postalCode"
                  placeholder="Postal code"
                  value={form.postalCode || ''}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  className="h-[40px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
                />
              </div>
            </>
          ) : null}
          {(form.locationType === 'ONLINE' || form.locationType === 'HYBRID') ? (
            <div className="md:col-span-2 flex flex-col gap-2">
              <Label htmlFor="onlineUrl" required className="text-base font-semibold text-black">Online URL</Label>
              <Input
                id="onlineUrl"
                value={form.onlineUrl || ''}
                error={fieldErrors.onlineUrl}
                onChange={(e) => updateField('onlineUrl', e.target.value)}
                className="h-[50px] rounded-[10px] border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-base placeholder:text-[#828283]"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 border-b border-[#bfbfbf] pb-8">
        <div className="flex items-center justify-between">
          <h3
            className="text-[24px] font-bold leading-8 text-black"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Ticket Types
          </h3>
          <button
            type="button"
            onClick={addTicketType}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-[#5c8bd9] px-4 text-base font-semibold text-white transition-colors hover:bg-[#4a7bc9]"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            <Plus className="h-5 w-5" />
            Add Ticket
          </button>
        </div>

        {(form.ticketTypes || []).length < 1 ? (
          <div className="w-full pt-8 pb-2">
            <p
              className="text-center text-[16px] font-normal leading-6 text-[#6a7282]"
              style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
            >
              {`No ticket types added yet. Click "Add Ticket" to create one.`}
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          {(form.ticketTypes || []).map((ticketType, index) => {
            const rowErrors = ticketErrors[index] || {}
            const normalizedCurrency = normalizeTicketCurrency(ticketType.currency)
            const legacyCurrency = normalizedCurrency && !isSupportedCurrency(normalizedCurrency)
              ? normalizedCurrency
              : null

            return (
              <div
                key={ticketType.id || `new-ticket-type-${index}`}
                className="rounded-[10px] border-[0.8px] border-[#e5e7eb] bg-[#f9fafb] p-4"
              >
                {/* Ticket header */}
                <div className="mb-4 flex items-center justify-between">
                  <p
                    className="text-[18px] font-semibold leading-7 text-black"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    {`Ticket ${index + 1}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeTicketType(index)}
                    className="flex h-5 w-5 items-center justify-center text-red-500 transition-colors hover:text-red-700"
                    aria-label={`Remove ticket ${index + 1}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* 2×2 field grid: Ticket Name | Capacity / Price | Currency */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Ticket Name */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`ticketTypeName-${index}`}
                      className="text-[14px] font-medium leading-5 text-[#4a5565]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      Ticket Name
                    </label>
                    <input
                      id={`ticketTypeName-${index}`}
                      type="text"
                      value={ticketType.name}
                      onChange={(event) => updateTicketTypeField(index, 'name', event.target.value)}
                      placeholder="e.g., General Admission"
                      className={`h-[41px] w-full rounded-[10px] border-[0.8px] bg-white px-4 py-2 text-[16px] text-black placeholder-[#828283] outline-none transition focus:border-[#5c8bd9] focus:ring-0 ${
                        rowErrors.name ? 'border-red-500' : 'border-[#d1d5dc]'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    />
                    {rowErrors.name ? <p className="text-sm text-red-600">{rowErrors.name}</p> : null}
                  </div>

                  {/* Capacity */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`ticketCapacity-${index}`}
                      className="text-[14px] font-medium leading-5 text-[#4a5565]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      Capacity
                    </label>
                    <input
                      id={`ticketCapacity-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      value={ticketType.capacity}
                      onChange={(event) => updateTicketTypeField(index, 'capacity', event.target.value)}
                      placeholder="Number of tickets available"
                      className={`h-[41px] w-full rounded-[10px] border-[0.8px] bg-white px-4 py-2 text-[16px] text-black placeholder-[#828283] outline-none transition focus:border-[#5c8bd9] focus:ring-0 ${
                        rowErrors.capacity ? 'border-red-500' : 'border-[#d1d5dc]'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    />
                    {rowErrors.capacity ? <p className="text-sm text-red-600">{rowErrors.capacity}</p> : null}
                  </div>

                  {/* Price */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`ticketPrice-${index}`}
                      className="text-[14px] font-medium leading-5 text-[#4a5565]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      Price
                    </label>
                    <input
                      id={`ticketPrice-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={ticketType.price}
                      onChange={(event) => updateTicketTypeField(index, 'price', event.target.value)}
                      placeholder="0"
                      className={`h-[41px] w-full rounded-[10px] border-[0.8px] bg-white px-4 py-2 text-[16px] text-black placeholder-[#828283] outline-none transition focus:border-[#5c8bd9] focus:ring-0 ${
                        rowErrors.price ? 'border-red-500' : 'border-[#d1d5dc]'
                      }`}
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    />
                    {rowErrors.price ? <p className="text-sm text-red-600">{rowErrors.price}</p> : null}
                  </div>

                  {/* Currency */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`ticketCurrency-${index}`}
                      className="text-[14px] font-medium leading-5 text-[#4a5565]"
                      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                    >
                      Currency
                    </label>
                    <div className="relative">
                      <select
                        id={`ticketCurrency-${index}`}
                        className={`h-[41px] w-full appearance-none rounded-[10px] border-[0.8px] bg-white px-4 py-2 text-[16px] text-black outline-none transition focus:border-[#5c8bd9] focus:ring-0 ${
                          rowErrors.currency ? 'border-red-500' : 'border-[#d1d5dc]'
                        }`}
                        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                        value={legacyCurrency || normalizedCurrency}
                        onChange={(event) => updateTicketTypeField(index, 'currency', event.target.value)}
                      >
                        {legacyCurrency ? (
                          <option value={legacyCurrency}>{`${legacyCurrency} (unsupported)`}</option>
                        ) : null}
                        <option value="SEK">SEK</option>
                        <option value="NOK">NOK</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="USD">USD</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4a5565]" />
                    </div>
                    {legacyCurrency ? (
                      <p className="text-sm text-amber-700">Select a supported currency before publishing.</p>
                    ) : null}
                    {rowErrors.currency ? <p className="text-sm text-red-600">{rowErrors.currency}</p> : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Promo Codes ──────────────────────────────────────────────────────── */}
      <section className="space-y-4 border-b border-[#d1d5dc] pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-black">Promo Codes</h3>
          <button
            type="button"
            onClick={addPromoCode}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-[#5c8bd9] px-4 text-base font-semibold text-white transition-colors hover:bg-[#4a7bc9]"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            Add Promo Code
          </button>
        </div>

        {promoCodes.length === 0 ? (
          <div className="flex h-[88px] w-full items-center justify-center">
            <p className="text-center text-base text-[#6a7282]">No promo codes added. Click &quot;Add Promo Code&quot; to create one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {promoCodes.map((promoCode, index) => {
              const availableTicketTypes = (form.ticketTypes || []).filter((t) => t.name.trim())
              return (
                <div
                  key={promoCode.id || `new-promo-${index}`}
                  className="rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] p-4"
                >
                  {/* Card header */}
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-lg font-semibold text-black">{`Promo Code ${index + 1}`}</p>
                    <button
                      type="button"
                      onClick={() => removePromoCode(index)}
                      className="text-red-500 transition-colors hover:text-red-700"
                      aria-label={`Remove promo code ${index + 1}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Row 1: Promo Code Name | Discount % */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-[#4a5565]" htmlFor={`promoCode-${index}`}>
                        Promo Code Name
                      </label>
                      <input
                        id={`promoCode-${index}`}
                        type="text"
                        value={promoCode.code}
                        placeholder="e.g., EARLYBIRD"
                        className="h-[42px] w-full rounded-[10px] border border-[#d1d5dc] bg-white px-4 text-base outline-none focus:border-[#5c8bd9] focus:ring-1 focus:ring-[#5c8bd9]"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\s/g, '').toUpperCase()
                          updatePromoCodeField(index, 'code', val)
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-[#4a5565]" htmlFor={`promoDiscount-${index}`}>
                        Discount %
                      </label>
                      <input
                        id={`promoDiscount-${index}`}
                        type="text"
                        inputMode="numeric"
                        value={promoCode.discountValue}
                        placeholder="e.g., 20"
                        className="h-[42px] w-full rounded-[10px] border border-[#d1d5dc] bg-white px-4 text-base outline-none focus:border-[#5c8bd9] focus:ring-1 focus:ring-[#5c8bd9]"
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '')
                          updatePromoCodeField(index, 'discountValue', val)
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Ticket Type | Usage Limit */}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-[#4a5565]" htmlFor={`promoTicketType-${index}`}>
                        Ticket Type
                      </label>
                      <div className="relative">
                        <select
                          id={`promoTicketType-${index}`}
                          value={promoCode.ticketTypeId}
                          className="h-[42px] w-full appearance-none rounded-[10px] border border-[#d1d5dc] bg-white px-4 pr-10 text-base outline-none focus:border-[#5c8bd9] focus:ring-1 focus:ring-[#5c8bd9]"
                          onChange={(e) => updatePromoCodeField(index, 'ticketTypeId', e.target.value)}
                        >
                          <option value="">Select ticket type to apply the promo code on</option>
                          {availableTicketTypes.map((t, ticketIndex) => (
                            <option key={t.id || `ticket-${ticketIndex}`} value={t.id || `ticket-${ticketIndex}`}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-[#4a5565]" htmlFor={`promoUsageLimit-${index}`}>
                        Usage Limit
                      </label>
                      <input
                        id={`promoUsageLimit-${index}`}
                        type="text"
                        inputMode="numeric"
                        value={promoCode.maxUses}
                        placeholder="0 = unlimited"
                        className="h-[42px] w-full rounded-[10px] border border-[#d1d5dc] bg-white px-4 text-base outline-none focus:border-[#5c8bd9] focus:ring-1 focus:ring-[#5c8bd9]"
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '')
                          updatePromoCodeField(index, 'maxUses', val)
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Minimum Cart Amount */}
                  <div className="mt-4 flex flex-col gap-1">
                    <label className="text-sm font-medium text-[#4a5565]" htmlFor={`promoMinCart-${index}`}>
                      Minimum Cart Amount
                    </label>
                    <input
                      id={`promoMinCart-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={promoCode.minCartAmount}
                      placeholder="Minimum amount to activate code"
                      className="h-[42px] w-full rounded-[10px] border border-[#d1d5dc] bg-white px-4 text-base outline-none focus:border-[#5c8bd9] focus:ring-1 focus:ring-[#5c8bd9]"
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        updatePromoCodeField(index, 'minCartAmount', val)
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-black">Speakers</h3>
              <button
                type="button"

                onClick={addSpeakerDraft}
                className="flex h-10 items-center gap-2 rounded-[10px] bg-[#5c8bd9] px-4 text-base font-semibold text-white transition-colors hover:bg-[#4a7bc9]"
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                Add Speaker
              </button>
            </div>

            <div className="space-y-4">
              {speakerDrafts.length === 0 && (
                <div className="flex h-[88px] w-full items-center justify-center">
                  <p className="text-center text-base text-[#6a7282]">
                    No speakers added. Click &quot;Add Speaker&quot; to add one.
                  </p>
                </div>
              )}
              {speakerDrafts.map((draft, index) => (
                <div key={draft.key} className="rounded-[10px] border border-[#828283] bg-[#f9fafb] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-800">Speaker {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeSpeakerDraft(draft.key)}
                      className="text-gray-400 transition-colors hover:text-red-500"
                      aria-label={`Remove Speaker ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-4">
                    {/* Circular image area */}
                    <div className="shrink-0">
                      {draft.previewUrl || draft.publicUrl ? (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openSpeakerReCrop(draft.key)}
                            className="relative h-24 w-24 overflow-hidden rounded-full border border-[#d1d5dc] bg-[#e5e7eb]"
                            aria-label="Edit photo"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={draft.previewUrl ?? (draft.speakerId ? `/api/speakers/${draft.speakerId}/image` : draft.publicUrl)}
                              alt={draft.name || `Speaker ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {draft.isUploading ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                                <span className="text-xs font-medium text-white">Uploading…</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                                <span className="text-xs font-medium text-white">Edit</span>
                              </div>
                            )}
                          </button>
                          {!draft.isUploading ? (
                            <button
                              type="button"
                              onClick={() => deleteSpeakerImage(draft.key)}
                              className="text-xs text-gray-400 transition-colors hover:text-red-500"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => triggerSpeakerImageSelect(draft.key)}
                          className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-[#d1d5dc] bg-[#e5e7eb] transition-colors hover:bg-gray-200"
                          aria-label="Upload photo"
                        >
                          <User className="h-8 w-8 text-gray-400" />
                          <span className="mt-1 text-xs text-gray-500">Upload</span>
                        </button>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={draft.name}
                          placeholder="Speaker name"
                          onChange={(e) => updateSpeakerDraft(draft.key, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={draft.title}
                          placeholder="Job title"
                          onChange={(e) => updateSpeakerDraft(draft.key, 'title', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Organization</Label>
                        <Input
                          value={draft.organization}
                          placeholder="Company/Organization"
                          onChange={(e) => updateSpeakerDraft(draft.key, 'organization', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
      </section>

      <section className="space-y-4 border-b border-[#d1d5dc] pb-4">
        {/* Hidden file inputs */}
        <input
          ref={bottomInputRef}
          id="bottomImageUpload"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => onImageSelected(event, 'bottomImage')}
          className="hidden"
          disabled={isUploadingBottom}
        />
        <input
          ref={videoInputRef}
          id="videoUpload"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(event) => void onVideoSelected(event)}
          className="hidden"
          disabled={isUploadingVideo}
        />

        <div>
          <h3 className="text-2xl font-bold text-black">Event Media</h3>
          <p className="mt-1 text-base text-[#4a5565]">Add images and videos to showcase your event</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Images column */}
          <div className="space-y-2">
            <p className="text-base font-semibold text-black">Images</p>

            <button
              type="button"
              onClick={() => bottomInputRef.current?.click()}
              disabled={isUploadingBottom}
              onDragEnter={(event) => onImageDragEnter(event, 'bottomImage')}
              onDragOver={(event) => onImageDragOver(event, 'bottomImage')}
              onDragLeave={(event) => onImageDragLeave(event, 'bottomImage')}
              onDrop={(event) => { void onImageDrop(event, 'bottomImage') }}
              aria-label={bottomImageSrc ? 'Change event image' : 'Add event image'}
              className={`group relative w-full cursor-pointer overflow-hidden rounded-[10px] border-[1.6px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8bd9] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                isBottomDropActive
                  ? 'border-[#5c8bd9] bg-blue-50/30'
                  : bottomImageSrc
                    ? 'border-[#d1d5dc]'
                    : 'border-[#d1d5dc] bg-white hover:border-[#5c8bd9] hover:bg-blue-50/10'
              }`}
            >
              {bottomImageSrc ? (
                <div className="relative aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bottomImageSrc}
                    alt="Event image"
                    className="h-full w-full object-cover transition duration-200 group-hover:brightness-90 group-focus-visible:brightness-90"
                  />
                  <div
                    className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-200 ${
                      isUploadingBottom || isBottomDropActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                    }`}
                  >
                    <span className="rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
                      {isUploadingBottom ? 'Uploading...' : isBottomDropActive ? 'Drop image' : 'Click to change image'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center gap-2 px-[25.6px] py-[25.6px] ${isBottomDropActive ? 'bg-blue-50/30' : ''}`}>
                  <ImageIcon className="h-10 w-10 text-[#5c8bd9]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[#4a5565]">
                    {isUploadingBottom ? 'Uploading...' : isBottomDropActive ? 'Drop image here' : 'Click to upload images'}
                  </span>
                </div>
              )}
            </button>

            {canEditBottomImage || croppedImageFiles.bottomImage ? (
              <div className="flex flex-wrap gap-2">
                {canEditBottomImage ? (
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={isPreparingCrop === 'bottomImage'}
                    onClick={() => { void openExistingCrop('bottomImage', bottomImageSrc) }}
                  >
                    Edit / Crop
                  </Button>
                ) : null}
                {croppedImageFiles.bottomImage ? (
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={isUploadingBottom}
                    onClick={() => void resetImageToOriginal('bottomImage')}
                  >
                    Undo crop
                  </Button>
                ) : null}
                {canEditBottomImage ? (
                  <Button type="button" variant="outline" onClick={() => deleteUploadedImage('bottomImage')}>
                    Delete image
                  </Button>
                ) : null}
              </div>
            ) : null}
            {fieldErrors.bottomImage ? <p className="text-sm text-red-600">{fieldErrors.bottomImage}</p> : null}
          </div>

          {/* Videos column */}
          <div className="space-y-2">
            <p className="text-base font-semibold text-black">Videos</p>

            {videoSrc ? (
              <div className="overflow-hidden rounded-[10px] border-[1.6px] border-[#d1d5dc]">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={videoSrc}
                  className="w-full"
                  controls
                  preload="metadata"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploadingVideo}
                aria-label="Upload video"
                className="group relative w-full cursor-pointer overflow-hidden rounded-[10px] border-[1.6px] border-[#d1d5dc] bg-white text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8bd9] focus-visible:ring-offset-2 hover:border-[#5c8bd9] hover:bg-blue-50/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <div className="flex flex-col items-center justify-center gap-2 px-[25.6px] py-[25.6px]">
                  <Video className="h-10 w-10 text-[#5c8bd9]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[#4a5565]">
                    {isUploadingVideo ? 'Uploading...' : 'Click to upload videos'}
                  </span>
                </div>
              </button>
            )}

            {videoSrc ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  isLoading={isUploadingVideo}
                  onClick={deleteVideo}
                >
                  Delete video
                </Button>
              </div>
            ) : null}
            {fieldErrors.videoUrl ? <p className="text-sm text-red-600">{fieldErrors.videoUrl}</p> : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-b border-[#d1d5dc] pb-4">
        <div>
          <h3 className="text-2xl font-bold text-black">Refund Policy</h3>
          <p className="mt-1 text-base text-[#4a5565]">Specify how long attendees can request a refund after purchasing a ticket</p>
        </div>

        <div className="flex flex-col gap-2 rounded-[10px] border-[0.8px] border-[#e5e7eb] bg-[#f9fafb] px-4 pt-4 pb-3">
          <p className="text-base font-semibold text-black">Refund Validity Period *</p>

          <div className="flex items-center gap-3">
            <input
              id="cancellationDeadlineHours"
              type="number"
              min={0}
              value={cancellationUnit === 'days'
                ? form.cancellationDeadlineHours / 24
                : form.cancellationDeadlineHours}
              onChange={(e) => {
                const raw = Number(e.target.value)
                if (!isNaN(raw) && raw >= 0) {
                  updateField('cancellationDeadlineHours', Math.round(raw * (cancellationUnit === 'days' ? 24 : 1)))
                }
              }}
              className="h-[40px] flex-1 rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-white px-4 text-base text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5c8bd9] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <div ref={unitDropdownRef} className="relative w-24 shrink-0">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isUnitOpen}
                onClick={() => setIsUnitOpen((o) => !o)}
                className="flex h-[40px] w-full items-center justify-between rounded-[10px] border-[0.8px] border-[#d1d5dc] bg-[#f9fafb] px-3 text-sm text-gray-900 hover:border-[#5c8bd9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8bd9]"
              >
                <span>{cancellationUnit}</span>
                <ChevronDown className={`ml-1 h-4 w-4 shrink-0 text-gray-500 transition-transform ${isUnitOpen ? 'rotate-180' : ''}`} />
              </button>
              {isUnitOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-full rounded-2xl bg-white py-2 shadow-2xl">
                  {(['hours', 'days'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => { setCancellationUnit(unit); setIsUnitOpen(false) }}
                      className={`w-full px-4 py-3 text-left text-[14px] transition-colors hover:bg-gray-50 ${cancellationUnit === unit ? 'font-semibold text-black' : 'text-gray-700'}`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-[#4a5565]">
            {`Attendees can request a refund within `}
            <strong className="font-bold">
              {cancellationUnit === 'days'
                ? form.cancellationDeadlineHours / 24
                : form.cancellationDeadlineHours}
              {` ${cancellationUnit}`}
            </strong>
            {` after purchasing their ticket`}
          </p>
        </div>
      </section>

      {submitError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      {isPublishedEvent ? (
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => submit('save')} isLoading={isSubmitting}>
            Save changes
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-4 border-t border-black/10 pt-6">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-[50px] w-[120px] rounded-[10px] bg-[#c8414e] text-white text-lg font-semibold hover:bg-[#b43944]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => submit('save')}
            isLoading={isSubmitting}
            className="h-[50px] w-[152px] rounded-[10px] bg-[#e5e7eb] text-[#4a5565] text-lg font-semibold hover:bg-[#d1d5dc]"
          >
            Save Draft
          </Button>
          <Button
            onClick={() => submit('publish')}
            isLoading={isSubmitting}
            className="h-[50px] w-[190px] rounded-[10px] bg-[#5c8bd9] text-white text-lg font-semibold shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)] hover:bg-[#4a7ac8]"
          >
            Publish Event
          </Button>
        </div>
      )}

      {cropSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">Edit image crop</h4>
            <p className="mt-1 text-sm text-gray-600">Adjust zoom and position, then apply crop.</p>

            <div className="relative mt-4 h-[420px] w-full overflow-hidden rounded-lg bg-gray-900">
              <Cropper
                image={cropSession.sourceUrl}
                crop={cropPosition}
                zoom={cropZoom}
                aspect={16 / 9}
                onCropChange={setCropPosition}
                onZoomChange={setCropZoom}
                onCropComplete={(_, croppedAreaPixels) => setCropPixels(croppedAreaPixels)}
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="cropZoom">Zoom</Label>
              <input
                id="cropZoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={cropZoom}
                onChange={(e) => setCropZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={closeCropper}>
                Close
              </Button>
              {cropSession.targetField === 'coverImage' && croppedImageFiles.coverImage ? (
                <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('coverImage')}>
                  Reset to original
                </Button>
              ) : null}
              {cropSession.targetField === 'bottomImage' && croppedImageFiles.bottomImage ? (
                <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('bottomImage')}>
                  Reset to original
                </Button>
              ) : null}
              <Button type="button" onClick={applyCrop} isLoading={isApplyingCrop}>
                Apply crop
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {speakerCropSession ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">Crop speaker photo</h4>
            <p className="mt-1 text-sm text-gray-600">Adjust zoom and position, then apply crop.</p>

            <div className="relative mt-4 h-72 w-full overflow-hidden rounded-lg bg-gray-900">
              <Cropper
                image={speakerCropSession.sourceUrl}
                crop={speakerCropPosition}
                zoom={speakerCropZoom}
                aspect={1}
                cropShape="round"
                onCropChange={setSpeakerCropPosition}
                onZoomChange={setSpeakerCropZoom}
                onCropComplete={(_, croppedAreaPixels) => setSpeakerCropPixels(croppedAreaPixels)}
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="speakerCropZoom">Zoom</Label>
              <input
                id="speakerCropZoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={speakerCropZoom}
                onChange={(e) => setSpeakerCropZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={closeSpeakerCropper}>
                Cancel
              </Button>
              <Button type="button" onClick={applySpeakerCrop} isLoading={isApplyingSpeakerCrop}>
                Apply crop
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <FloatingToast
        message={toast?.message || null}
        tone={toast?.tone || 'success'}
        onDismiss={() => setToast(null)}
      />
    </div>
  )
}
