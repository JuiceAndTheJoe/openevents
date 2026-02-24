'use client'

import Cropper, { Area } from 'react-easy-crop'
import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingToast } from '@/components/ui/floating-toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, isSupportedCurrency } from '@/lib/constants/currencies'
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
  speakerNames?: string
  organizerNames?: string
  sponsorNames?: string
  visibility: 'PUBLIC' | 'PRIVATE'
  cancellationDeadlineHours: number
  categoryIds?: string[]
}

type EventFormProps = {
  mode: EventFormMode
  initialData?: EventFormData
  children?: ReactNode
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

type FieldErrors = Partial<Record<FieldKey, string>>

type CropSession = {
  targetField: ImageTargetField
  sourceUrl: string
  fileName: string
  mimeType: string
}

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
  speakerNames: '',
  organizerNames: '',
  sponsorNames: '',
  visibility: 'PUBLIC',
  cancellationDeadlineHours: 48,
  categoryIds: [],
}

const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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

function parseNameList(raw?: string | null): string[] {
  return (raw || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

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
  })
}

export function EventForm({ mode, initialData, children }: EventFormProps) {
  const t = useTranslations('eventForm')
  const router = useRouter()
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const bottomInputRef = useRef<HTMLInputElement | null>(null)
  const bannerObjectUrlRef = useRef<string | null>(null)
  const bottomObjectUrlRef = useRef<string | null>(null)
  const cropObjectUrlRef = useRef<string | null>(null)

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
  const [isPreparingCrop, setIsPreparingCrop] = useState<ImageTargetField | null>(null)
  const [isApplyingCrop, setIsApplyingCrop] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [ticketErrors, setTicketErrors] = useState<TicketTypeFieldErrors[]>(
    initialTicketTypes.map(() => ({}))
  )
  const [generalErrors, setGeneralErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [bannerPreviewSrc, setBannerPreviewSrc] = useState<string | null>(null)
  const [bottomPreviewSrc, setBottomPreviewSrc] = useState<string | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [cropSession, setCropSession] = useState<CropSession | null>(null)
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [cropPixels, setCropPixels] = useState<Area | null>(null)
  const [activeDropTarget, setActiveDropTarget] = useState<ImageTargetField | null>(null)
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

    if (ticket.id && !window.confirm(t('removeTicketConfirm'))) {
      return
    }

    setForm((current) => ({
      ...current,
      ticketTypes: (current.ticketTypes || []).filter((_, ticketIndex) => ticketIndex !== index),
    }))
    setTicketErrors((current) => current.filter((_, ticketIndex) => ticketIndex !== index))
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
    return () => {
      if (bannerObjectUrlRef.current) {
        URL.revokeObjectURL(bannerObjectUrlRef.current)
      }
      if (bottomObjectUrlRef.current) {
        URL.revokeObjectURL(bottomObjectUrlRef.current)
      }
      if (cropObjectUrlRef.current) {
        URL.revokeObjectURL(cropObjectUrlRef.current)
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
        maxPerOrder: 10,
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
  }

  function validate(action: 'save' | 'publish') {
    const nextFieldErrors: FieldErrors = {}
    const nextTicketErrors: TicketTypeFieldErrors[] = (form.ticketTypes || []).map(() => ({}))
    const nextGeneralErrors: string[] = []
    const requireComplete = action === 'publish'

    const timezone = isValidTimeZone(form.timezone) ? form.timezone : 'UTC'
    const startUtc = dateTimeLocalInTimeZoneToUtcIso(form.startDate, timezone)
    const endUtc = dateTimeLocalInTimeZoneToUtcIso(form.endDate, timezone)

    if (!form.title?.trim()) nextFieldErrors.title = t('validation.titleRequired')

    if (!form.startDate?.trim()) {
      nextFieldErrors.startDate = t('validation.startRequired')
    } else if (!startUtc) {
      nextFieldErrors.startDate = t('validation.startInvalid')
    }

    if (!form.endDate?.trim()) {
      nextFieldErrors.endDate = t('validation.endRequired')
    } else if (!endUtc) {
      nextFieldErrors.endDate = t('validation.endInvalid')
    }

    if (!form.timezone?.trim()) {
      nextFieldErrors.timezone = t('validation.timezoneRequired')
    } else if (!isValidTimeZone(form.timezone)) {
      nextFieldErrors.timezone = t('validation.timezoneInvalid')
    }

    if (startUtc && endUtc && new Date(endUtc) <= new Date(startUtc)) {
      nextFieldErrors.endDate = t('validation.endAfterStart')
    }

    if (requireComplete && form.locationType !== 'ONLINE') {
      if (!form.venue?.trim()) nextFieldErrors.venue = t('validation.venueRequired')
      if (!form.address?.trim()) nextFieldErrors.address = t('validation.addressRequired')
      if (!form.city?.trim()) nextFieldErrors.city = t('validation.cityRequired')
      if (!form.country?.trim()) nextFieldErrors.country = t('validation.countryRequired')
    }

    if (
      requireComplete &&
      (form.locationType === 'ONLINE' || form.locationType === 'HYBRID') &&
      !form.onlineUrl?.trim()
    ) {
      nextFieldErrors.onlineUrl = t('validation.onlineUrlRequired')
    }

    if (requireComplete && !form.description?.trim()) {
      nextFieldErrors.description = t('validation.descriptionRequired')
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

      if (!name) rowErrors.name = t('validation.ticketNameRequired')
      if (price === null || price < 0) rowErrors.price = t('validation.ticketPriceInvalid')
      if (!isSupportedCurrency(currency)) rowErrors.currency = t('validation.ticketCurrencyInvalid')
      if (maxCapacity !== null && (!Number.isInteger(maxCapacity) || maxCapacity < 1)) {
        rowErrors.capacity = t('validation.ticketCapacityInvalid')
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
        nextTicketErrors[index].name = t('validation.ticketNamesUnique')
      }
    }

    if (requireComplete && ticketTypes.length < 1) {
      nextGeneralErrors.push(t('validation.addTicketBeforePublish'))
    }

    if (requireComplete && ticketTypes.length > 0 && !hasPublishableTicketType) {
      nextGeneralErrors.push(t('validation.fixTicketDetails'))
    }

    const hasTicketErrors = nextTicketErrors.some((row) => Object.keys(row).length > 0)

    if (action === 'publish' && Object.keys(nextFieldErrors).length > 0) {
      nextGeneralErrors.push(t('validation.fixHighlightedPublish'))
    }

    if (action === 'save' && (Object.keys(nextFieldErrors).length > 0 || hasTicketErrors)) {
      nextGeneralErrors.push(t('validation.fixHighlightedSave'))
    }

    if (action === 'publish' && hasTicketErrors) {
      nextGeneralErrors.push(t('validation.fixTicketFieldsPublish'))
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

  async function resetImageToOriginal(targetField: ImageTargetField) {
    const originalFile = originalImageFiles[targetField]
    if (!originalFile) return

    if (targetField === 'coverImage') {
      setIsUploadingBanner(true)
    } else {
      setIsUploadingBottom(true)
    }

    try {
      setCroppedImageFiles((current) => ({ ...current, [targetField]: null }))
      setEditableImageFiles((current) => ({ ...current, [targetField]: originalFile }))
      setLocalPreview(originalFile, targetField)
      await uploadEventImage(originalFile, targetField)
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
        speakerNames: parseNameList(form.speakerNames),
        organizerNames: parseNameList(form.organizerNames),
        sponsorNames: parseNameList(form.sponsorNames),
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
        await syncTicketTypes(eventId, action)
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
        setToast({ message: action === 'publish' ? t('eventPublished') : t('eventUpdated'), tone: 'success' })
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

    if (isDirty && !window.confirm(t('discardConfirm'))) {
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
  const isBannerDropActive = activeDropTarget === 'coverImage'
  const isBottomDropActive = activeDropTarget === 'bottomImage'

  const canEditCoverImage = Boolean(bannerImageSrc || editableImageFiles.coverImage || originalImageFiles.coverImage)
  const canEditBottomImage = Boolean(bottomImageSrc || editableImageFiles.bottomImage || originalImageFiles.bottomImage)
  const isPublishedEvent = mode === 'edit' && form.status === 'PUBLISHED'

  return (
    <div className="space-y-8 px-1 sm:px-0">
      <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
        {mode === 'create' ? t('titleCreate') : t('titleEdit')}
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
        aria-label={bannerImageSrc ? t('changeBannerAriaLabel') : t('addBannerAriaLabel')}
        className={`group relative block aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-xl border-4 bg-gray-900 text-left transition-shadow duration-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
          isBannerDropActive
            ? 'border-blue-500 ring-2 ring-blue-500/40'
            : bannerImageSrc
              ? 'border-blue-500'
              : 'border-dashed border-blue-400'
        }`}
      >
        {bannerImageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerImageSrc}
            alt={t('bannerAlt')}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01] group-hover:brightness-95 group-focus-visible:brightness-95"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-700 to-slate-900" />
        )}

        {bannerImageSrc ? (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 p-4 transition-opacity duration-200 ${
              isUploadingBanner || isBannerDropActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
            }`}
          >
            <span className="inline-flex rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
              {isUploadingBanner ? t('uploading') : isBannerDropActive ? t('dropImage', { target: t('bannerTarget') }) : t('clickToChange', { target: t('bannerTarget') })}
            </span>
          </div>
        ) : (
          <div
            className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center transition-colors duration-200 ${
              isUploadingBanner || isBannerDropActive
                ? 'bg-black/55'
                : 'bg-black/30 group-hover:bg-black/40 group-focus-visible:bg-black/40'
            }`}
          >
            <Upload className="h-5 w-5 text-white/90" aria-hidden="true" />
            <p className="text-base font-medium text-white">
              {isUploadingBanner ? t('uploading') : isBannerDropActive ? t('dropImage', { target: t('bannerTarget') }) : t('clickToAdd', { target: t('bannerTarget') })}
            </p>
            <p className="text-xs text-gray-200">
              {isUploadingBanner ? t('pleaseWait') : isBannerDropActive ? t('releaseToUpload') : t('orDragAndDrop')}
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
              {t('editCropBanner')}
            </Button>
          ) : null}
          {croppedImageFiles.coverImage ? (
            <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('coverImage')}>
              {t('resetBanner')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {fieldErrors.coverImage ? <p className="text-sm text-red-600">{fieldErrors.coverImage}</p> : null}

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">{t('eventHeaderSection')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title" required>{t('titleLabel')}</Label>
            <Input id="title" value={form.title} error={fieldErrors.title} onChange={(e) => updateField('title', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="startDate" required>{t('startLabel')}</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={form.startDate}
              error={fieldErrors.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate" required>{t('endLabel')}</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={form.endDate}
              error={fieldErrors.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="timezone" required>{t('timezoneLabel')}</Label>
            <select
              id="timezone"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={form.timezone}
              onChange={(e) => onTimezoneChanged(e.target.value)}
            >
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>{timezone}</option>
              ))}
            </select>
            {fieldErrors.timezone ? <p className="mt-1 text-sm text-red-600">{fieldErrors.timezone}</p> : null}
          </div>
          <div>
            <Label htmlFor="locationType" required>{t('locationTypeLabel')}</Label>
            <select
              id="locationType"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={form.locationType}
              onChange={(e) => updateField('locationType', e.target.value as EventFormData['locationType'])}
            >
              <option value="PHYSICAL">{t('locationPhysical')}</option>
              <option value="ONLINE">{t('locationOnline')}</option>
              <option value="HYBRID">{t('locationHybrid')}</option>
            </select>
          </div>
          {form.locationType !== 'ONLINE' ? (
            <>
              <div>
                <Label htmlFor="venue" required>{t('venueLabel')}</Label>
                <Input id="venue" value={form.venue || ''} error={fieldErrors.venue} onChange={(e) => updateField('venue', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="address" required>{t('addressLabel')}</Label>
                <Input
                  id="address"
                  value={form.address || ''}
                  error={fieldErrors.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="city" required>{t('cityLabel')}</Label>
                <Input id="city" value={form.city || ''} error={fieldErrors.city} onChange={(e) => updateField('city', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="state">{t('stateLabel')}</Label>
                <Input id="state" value={form.state || ''} onChange={(e) => updateField('state', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="country" required>{t('countryLabel')}</Label>
                <Input id="country" value={form.country || ''} error={fieldErrors.country} onChange={(e) => updateField('country', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="postalCode">{t('postalCodeLabel')}</Label>
                <Input id="postalCode" value={form.postalCode || ''} onChange={(e) => updateField('postalCode', e.target.value)} />
              </div>
            </>
          ) : null}
          {(form.locationType === 'ONLINE' || form.locationType === 'HYBRID') ? (
            <div className="md:col-span-2">
              <Label htmlFor="onlineUrl" required>{t('onlineUrlLabel')}</Label>
              <Input id="onlineUrl" value={form.onlineUrl || ''} error={fieldErrors.onlineUrl} onChange={(e) => updateField('onlineUrl', e.target.value)} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">{t('overviewSection')}</h3>
        <div>
          <Label htmlFor="description" required>{t('descriptionLabel')}</Label>
          <textarea
            id="description"
            className="min-h-40 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
          />
          {fieldErrors.description ? <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p> : null}
        </div>
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">{t('programSection')}</h3>
        <p className="text-sm text-gray-600">
          {children ? t('programManage') : t('programAddNow')}
        </p>
        <div className={`grid grid-cols-1 gap-4 ${mode === 'create' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {mode === 'create' ? (
            <div>
              <Label htmlFor="speakerNames">{t('speakersLabel')}</Label>
              <Input
                id="speakerNames"
                placeholder="Jane Doe, John Doe"
                value={form.speakerNames || ''}
                onChange={(e) => updateField('speakerNames', e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="organizerNames">{t('jobTitleLabel')}</Label>
            <Input
              id="organizerNames"
              placeholder="Developer, Consultant"
              value={form.organizerNames || ''}
              onChange={(e) => updateField('organizerNames', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sponsorNames">{t('organizationLabel')}</Label>
            <Input
              id="sponsorNames"
              placeholder="Tech Corp, Innovation Inc"
              value={form.sponsorNames || ''}
              onChange={(e) => updateField('sponsorNames', e.target.value)}
            />
          </div>
        </div>

        {children ? (
          <div className="space-y-5 border-t border-gray-200 pt-5">
            {children}
          </div>
        ) : null}
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-3xl font-semibold text-gray-900">{t('ticketTypesSection')}</h3>
          <Button type="button" variant="outline" onClick={addTicketType}>
            {t('addTicketType')}
          </Button>
        </div>

        {(form.ticketTypes || []).length < 1 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            {t('noTicketTypes')}
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
              <div key={ticketType.id || `new-ticket-type-${index}`} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">{t('ticketTypeIndex', { index: index + 1 })}</p>
                  <Button type="button" variant="outline" onClick={() => removeTicketType(index)}>
                    {t('removeTicketType')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Label htmlFor={`ticketTypeName-${index}`} required>{t('ticketNameLabel')}</Label>
                    <Input
                      id={`ticketTypeName-${index}`}
                      value={ticketType.name}
                      error={rowErrors.name}
                      onChange={(event) => updateTicketTypeField(index, 'name', event.target.value)}
                      placeholder="General Admission"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`ticketPrice-${index}`} required>{t('ticketPriceLabel')}</Label>
                    <Input
                      id={`ticketPrice-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={ticketType.price}
                      error={rowErrors.price}
                      onChange={(event) => updateTicketTypeField(index, 'price', event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`ticketCurrency-${index}`} required>{t('currencyLabel')}</Label>
                    <select
                      id={`ticketCurrency-${index}`}
                      className={`h-10 w-full rounded-md border px-3 text-sm ${
                        rowErrors.currency ? 'border-red-500' : 'border-gray-300'
                      }`}
                      value={legacyCurrency || normalizedCurrency}
                      onChange={(event) => updateTicketTypeField(index, 'currency', event.target.value)}
                    >
                      {legacyCurrency ? (
                        <option value={legacyCurrency}>{t('legacyCurrency', { currency: legacyCurrency })}</option>
                      ) : null}
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                    {legacyCurrency ? (
                      <p className="mt-1 text-sm text-amber-700">{t('selectSupportedCurrency')}</p>
                    ) : null}
                    {rowErrors.currency ? <p className="mt-1 text-sm text-red-600">{rowErrors.currency}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor={`ticketCapacity-${index}`}>{t('capacityLabel')}</Label>
                    <Input
                      id={`ticketCapacity-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      value={ticketType.capacity}
                      error={rowErrors.capacity}
                      onChange={(event) => updateTicketTypeField(index, 'capacity', event.target.value)}
                      placeholder={t('capacityPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">{t('bottomVisualSection')}</h3>
        <input
          ref={bottomInputRef}
          id="bottomImageUpload"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => onImageSelected(event, 'bottomImage')}
          className="hidden"
          disabled={isUploadingBottom}
        />
        <button
          type="button"
          onClick={() => bottomInputRef.current?.click()}
          disabled={isUploadingBottom}
          onDragEnter={(event) => onImageDragEnter(event, 'bottomImage')}
          onDragOver={(event) => onImageDragOver(event, 'bottomImage')}
          onDragLeave={(event) => onImageDragLeave(event, 'bottomImage')}
          onDrop={(event) => {
            void onImageDrop(event, 'bottomImage')
          }}
          aria-label={bottomImageSrc ? t('changeBottomAriaLabel') : t('addBottomAriaLabel')}
          className={`group relative block aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-xl border-4 bg-gray-900 text-left transition-shadow duration-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
            isBottomDropActive
              ? 'border-blue-500 ring-2 ring-blue-500/40'
              : bottomImageSrc
                ? 'border-blue-500'
                : 'border-dashed border-blue-400'
          }`}
        >
          {bottomImageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bottomImageSrc}
              alt={t('bottomAlt')}
              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01] group-hover:brightness-95 group-focus-visible:brightness-95"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-slate-700 to-slate-900" />
          )}

          {bottomImageSrc ? (
            <div
              className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 p-4 transition-opacity duration-200 ${
                isUploadingBottom || isBottomDropActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
              }`}
            >
              <span className="inline-flex rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
                {isUploadingBottom ? t('uploading') : isBottomDropActive ? t('dropImage', { target: t('bottomTarget') }) : t('clickToChange', { target: t('bottomTarget') })}
              </span>
            </div>
          ) : (
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center transition-colors duration-200 ${
                isUploadingBottom || isBottomDropActive
                  ? 'bg-black/55'
                  : 'bg-black/30 group-hover:bg-black/40 group-focus-visible:bg-black/40'
              }`}
            >
              <Upload className="h-5 w-5 text-white/90" aria-hidden="true" />
              <p className="text-base font-medium text-white">
                {isUploadingBottom ? t('uploading') : isBottomDropActive ? t('dropImage', { target: t('bottomTarget') }) : t('clickToAdd', { target: t('bottomTarget') })}
              </p>
              <p className="text-xs text-gray-200">
                {isUploadingBottom ? t('pleaseWait') : isBottomDropActive ? t('releaseToUpload') : t('orDragAndDrop')}
              </p>
            </div>
          )}
        </button>

        {canEditBottomImage || croppedImageFiles.bottomImage ? (
          <div className="flex flex-wrap gap-3">
            {canEditBottomImage ? (
              <Button
                type="button"
                variant="outline"
                isLoading={isPreparingCrop === 'bottomImage'}
                onClick={() => {
                  void openExistingCrop('bottomImage', bottomImageSrc)
                }}
              >
                {t('editCropBottom')}
              </Button>
            ) : null}
            {croppedImageFiles.bottomImage ? (
              <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('bottomImage')}>
                {t('resetBottom')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {fieldErrors.bottomImage ? <p className="text-sm text-red-600">{fieldErrors.bottomImage}</p> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="visibility">{t('visibilityLabel')}</Label>
            <select
              id="visibility"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={form.visibility}
              onChange={(e) => updateField('visibility', e.target.value as EventFormData['visibility'])}
            >
              <option value="PUBLIC">{t('visibilityPublic')}</option>
              <option value="PRIVATE">{t('visibilityPrivate')}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cancellationDeadlineHours">{t('cancellationDeadlineLabel')}</Label>
            <Input
              id="cancellationDeadlineHours"
              type="number"
              min={0}
              value={form.cancellationDeadlineHours}
              onChange={(e) => updateField('cancellationDeadlineHours', Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="categoryIds">{t('categoryIdsLabel')}</Label>
            <Input
              id="categoryIds"
              value={form.categoryIds?.join(',') || ''}
              onChange={(e) => {
                const ids = e.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
                updateField('categoryIds', ids)
              }}
            />
          </div>
        </div>
      </section>

      {submitError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('cancelButton')}
        </Button>
        {isPublishedEvent ? (
          <Button onClick={() => submit('save')} isLoading={isSubmitting}>
            {t('saveChangesButton')}
          </Button>
        ) : (
          <>
            <Button onClick={() => submit('save')} isLoading={isSubmitting}>
              {t('saveDraftButton')}
            </Button>
            <Button variant="outline" onClick={() => submit('publish')} isLoading={isSubmitting}>
              {t('publishButton')}
            </Button>
          </>
        )}
      </div>

      {cropSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">{t('cropTitle')}</h4>
            <p className="mt-1 text-sm text-gray-600">{t('cropDescription')}</p>

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
              <Label htmlFor="cropZoom">{t('zoomLabel')}</Label>
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
                {t('closeButton')}
              </Button>
              {cropSession.targetField === 'coverImage' && croppedImageFiles.coverImage ? (
                <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('coverImage')}>
                  {t('resetToOriginal')}
                </Button>
              ) : null}
              {cropSession.targetField === 'bottomImage' && croppedImageFiles.bottomImage ? (
                <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('bottomImage')}>
                  {t('resetToOriginal')}
                </Button>
              ) : null}
              <Button type="button" onClick={applyCrop} isLoading={isApplyingCrop}>
                {t('applyCropButton')}
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
