'use client'

import Cropper, { Area } from 'react-easy-crop'
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type EventFormData = {
  id?: string
  slug?: string
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
  | 'city'
  | 'country'
  | 'onlineUrl'
  | 'ticketTypeName'
  | 'ticketPrice'
  | 'ticketCurrency'
  | 'ticketCapacity'
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
  'city',
  'country',
  'onlineUrl',
  'description',
  'ticketTypeName',
  'ticketPrice',
  'ticketCurrency',
  'ticketCapacity',
  'coverImage',
  'bottomImage',
]

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

function focusFirstInvalidField(fieldErrors: FieldErrors) {
  const first = fieldOrder.find((key) => Boolean(fieldErrors[key]))
  if (!first) return

  requestAnimationFrame(() => {
    const element = document.getElementById(first)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      element.focus()
    }
  })
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
    ticketTypeName: form.ticketTypeName || '',
    ticketPrice: form.ticketPrice || '',
    ticketCurrency: normalizeTicketCurrency(form.ticketCurrency),
    ticketCapacity: form.ticketCapacity || '',
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

  const initialFormState = useMemo<EventFormData>(() => ({
    ...mergedInitialData,
    timezone: normalizedInitialTimezone,
    description: mergedInitialData.description || mergedInitialData.descriptionHtml || '',
    startDate: formatUtcInTimeZoneForInput(mergedInitialData.startDate, normalizedInitialTimezone),
    endDate: formatUtcInTimeZoneForInput(mergedInitialData.endDate, normalizedInitialTimezone),
    ticketCurrency: normalizeTicketCurrency(mergedInitialData.ticketCurrency),
  }), [mergedInitialData, normalizedInitialTimezone])

  const initialSnapshotRef = useRef(buildSnapshot(initialFormState))

  const [form, setForm] = useState<EventFormData>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isUploadingBottom, setIsUploadingBottom] = useState(false)
  const [isPreparingCrop, setIsPreparingCrop] = useState<ImageTargetField | null>(null)
  const [isApplyingCrop, setIsApplyingCrop] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
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

  async function upsertPrimaryTicketType(eventId: string, requireComplete: boolean) {
    const ticketName = (form.ticketTypeName || '').trim()
    const ticketPrice = parseTicketPrice(form.ticketPrice)
    const normalizedCurrency = normalizeTicketCurrency(form.ticketCurrency)
    const capacityRaw = (form.ticketCapacity || '').trim()
    const maxCapacity = capacityRaw ? Number(capacityRaw) : null

    if (requireComplete && !ticketName) {
      throw new Error('Tickets -> Ticket Name: Enter a ticket name.')
    }

    if (requireComplete && (ticketPrice === null || ticketPrice < 0)) {
      throw new Error('Tickets -> Ticket Price: Enter a valid price (0 or greater).')
    }

    if (requireComplete && !isSupportedCurrency(normalizedCurrency)) {
      throw new Error('Tickets -> Currency: Select a supported currency.')
    }

    if (!requireComplete) {
      const hasAnyTicketInput =
        Boolean(form.ticketTypeId) ||
        Boolean(ticketName) ||
        Boolean((form.ticketPrice || '').trim()) ||
        Boolean((form.ticketCurrency || '').trim()) ||
        Boolean(capacityRaw)

      if (!hasAnyTicketInput) return
      if (!ticketName || ticketPrice === null || !isSupportedCurrency(normalizedCurrency)) return
    }

    if (maxCapacity !== null && (!Number.isInteger(maxCapacity) || maxCapacity < 1)) {
      throw new Error('Tickets -> Capacity: Enter a whole number greater than 0, or leave empty.')
    }

    const payload = {
      name: ticketName,
      price: ticketPrice,
      currency: normalizedCurrency,
      maxCapacity,
      isVisible: true,
      minPerOrder: 1,
      maxPerOrder: 10,
      sortOrder: 0,
    }

    const hasExistingTicketType = Boolean(form.ticketTypeId)
    const endpoint = hasExistingTicketType
      ? `/api/events/${eventId}/ticket-types/${form.ticketTypeId}`
      : `/api/events/${eventId}/ticket-types`
    const method = hasExistingTicketType ? 'PATCH' : 'POST'

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const json = await response.json()
    if (!response.ok) {
      const currencyError = parseFirstFieldError(json?.details, 'currency')
      if (currencyError) {
        setFieldErrors((current) => ({ ...current, ticketCurrency: currencyError }))
      }
      throw new Error(json?.error || 'Failed to save ticket type')
    }

    if (!hasExistingTicketType && json?.ticketType?.id) {
      updateField('ticketTypeId', json.ticketType.id)
    }
  }

  function validate(action: 'save' | 'publish') {
    const nextFieldErrors: FieldErrors = {}
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

    const ticketPrice = parseTicketPrice(form.ticketPrice)
    const normalizedCurrency = normalizeTicketCurrency(form.ticketCurrency)
    const hasAnyTicketInput =
      Boolean(form.ticketTypeId) ||
      Boolean((form.ticketTypeName || '').trim()) ||
      Boolean((form.ticketPrice || '').trim() && form.ticketPrice !== '0') ||
      Boolean((form.ticketCapacity || '').trim())

    if (requireComplete || hasAnyTicketInput) {
      if (!form.ticketTypeName?.trim()) nextFieldErrors.ticketTypeName = 'Enter ticket name.'
      if (ticketPrice === null || ticketPrice < 0) nextFieldErrors.ticketPrice = 'Enter a valid price (0 or greater).'
      if (!isSupportedCurrency(normalizedCurrency)) nextFieldErrors.ticketCurrency = 'Select a supported currency.'
    }

    const capacityRaw = (form.ticketCapacity || '').trim()
    if (capacityRaw && (requireComplete || hasAnyTicketInput)) {
      const maxCapacity = Number(capacityRaw)
      if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
        nextFieldErrors.ticketCapacity = 'Enter a whole number greater than 0 or leave empty.'
      }
    }

    if (action === 'publish' && Object.keys(nextFieldErrors).length > 0) {
      nextGeneralErrors.push('Cannot publish yet. Fix the highlighted fields.')
    }

    if (action === 'save' && Object.keys(nextFieldErrors).length > 0) {
      nextGeneralErrors.push('Please fix the highlighted fields before saving.')
    }

    return {
      fieldErrors: nextFieldErrors,
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

  async function onImageSelected(event: ChangeEvent<HTMLInputElement>, targetField: ImageTargetField) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!allowedImageMimeTypes.has(file.type)) {
      setFieldErrors((current) => ({
        ...current,
        [targetField]: 'Please select a JPG, PNG, WEBP, or GIF image.',
      }))
      setToast({ message: 'Unsupported image format', tone: 'error' })
      event.target.value = ''
      return
    }

    setOriginalImageFiles((current) => ({ ...current, [targetField]: file }))
    setCroppedImageFiles((current) => ({ ...current, [targetField]: null }))
    setEditableImageFiles((current) => ({ ...current, [targetField]: file }))
    openCropper(file, targetField)
    event.target.value = ''
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

    if (Object.keys(validationResult.fieldErrors).length > 0) {
      setGeneralErrors(validationResult.generalErrors)
      focusFirstInvalidField(validationResult.fieldErrors)
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
        ticketCurrency: normalizeTicketCurrency(form.ticketCurrency),
        onlineUrl: form.onlineUrl || null,
        coverImage: form.coverImage || null,
        bottomImage: form.bottomImage || null,
        speakerNames: parseNameList(form.speakerNames),
        organizerNames: parseNameList(form.organizerNames),
        sponsorNames: parseNameList(form.sponsorNames),
        categoryIds: form.categoryIds,
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
          focusFirstInvalidField(apiFieldErrors)
        }

        throw new Error(eventJson?.error || 'Failed to save event')
      }

      const eventId = eventJson?.data?.id || form.id
      const eventSlug = (eventJson?.data?.slug as string | undefined) || form.slug

      if (eventId) {
        await upsertPrimaryTicketType(eventId, action === 'publish')
      }

      if (action === 'publish' && eventId) {
        const publishRes = await fetch(`/api/events/${eventId}/publish`, {
          method: 'POST',
        })

        const publishJson = await publishRes.json()
        if (!publishRes.ok) {
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

  const legacyTicketCurrency = (() => {
    const current = normalizeTicketCurrency(form.ticketCurrency)
    return current && !isSupportedCurrency(current) ? current : null
  })()

  const canEditCoverImage = Boolean(bannerImageSrc || editableImageFiles.coverImage || originalImageFiles.coverImage)
  const canEditBottomImage = Boolean(bottomImageSrc || editableImageFiles.bottomImage || originalImageFiles.bottomImage)

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

      <section className="aspect-[16/9] overflow-hidden rounded-xl border-4 border-blue-500 bg-gray-900">
        {bannerImageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerImageSrc} alt="Event banner" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-700 to-slate-900" />
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <input
          ref={bannerInputRef}
          id="coverImageUpload"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => onImageSelected(event, 'coverImage')}
          className="hidden"
          disabled={isUploadingBanner}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => bannerInputRef.current?.click()}
          isLoading={isUploadingBanner}
        >
          Add banner image
        </Button>
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
          <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('coverImage')}>
            Reset banner
          </Button>
        ) : null}
      </div>
      {fieldErrors.coverImage ? <p className="text-sm text-red-600">{fieldErrors.coverImage}</p> : null}

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">Event Header</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title" required>Title</Label>
            <Input id="title" value={form.title} error={fieldErrors.title} onChange={(e) => updateField('title', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="startDate" required>Start</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={form.startDate}
              error={fieldErrors.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate" required>End</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={form.endDate}
              error={fieldErrors.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="timezone" required>Timezone</Label>
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
            <Label htmlFor="locationType" required>Location Type</Label>
            <select
              id="locationType"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={form.locationType}
              onChange={(e) => updateField('locationType', e.target.value as EventFormData['locationType'])}
            >
              <option value="PHYSICAL">Physical</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
          {form.locationType !== 'ONLINE' ? (
            <>
              <div>
                <Label htmlFor="venue" required>Venue</Label>
                <Input id="venue" value={form.venue || ''} error={fieldErrors.venue} onChange={(e) => updateField('venue', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="city" required>City</Label>
                <Input id="city" value={form.city || ''} error={fieldErrors.city} onChange={(e) => updateField('city', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={form.state || ''} onChange={(e) => updateField('state', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="country" required>Country</Label>
                <Input id="country" value={form.country || ''} error={fieldErrors.country} onChange={(e) => updateField('country', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" value={form.postalCode || ''} onChange={(e) => updateField('postalCode', e.target.value)} />
              </div>
            </>
          ) : null}
          {(form.locationType === 'ONLINE' || form.locationType === 'HYBRID') ? (
            <div className="md:col-span-2">
              <Label htmlFor="onlineUrl" required>Online URL</Label>
              <Input id="onlineUrl" value={form.onlineUrl || ''} error={fieldErrors.onlineUrl} onChange={(e) => updateField('onlineUrl', e.target.value)} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">Overview</h3>
        <div>
          <Label htmlFor="description" required>Description</Label>
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
        <h3 className="text-3xl font-semibold text-gray-900">Program</h3>
        <p className="text-sm text-gray-600">
          {children
            ? 'Manage people and schedule in one place so agenda items can be linked to speakers.'
            : 'Add program people now. After your first save, you can manage detailed speakers and agenda here.'}
        </p>
        <div className={`grid grid-cols-1 gap-4 ${mode === 'create' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {mode === 'create' ? (
            <div>
              <Label htmlFor="speakerNames">Speakers</Label>
              <Input
                id="speakerNames"
                placeholder="Jane Doe, John Doe"
                value={form.speakerNames || ''}
                onChange={(e) => updateField('speakerNames', e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="organizerNames">Organizers</Label>
            <Input
              id="organizerNames"
              placeholder="OpenEvents Team"
              value={form.organizerNames || ''}
              onChange={(e) => updateField('organizerNames', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sponsorNames">Sponsors</Label>
            <Input
              id="sponsorNames"
              placeholder="Company A, Company B"
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
        <h3 className="text-3xl font-semibold text-gray-900">Tickets</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="ticketTypeName" required>Ticket Name</Label>
            <Input
              id="ticketTypeName"
              value={form.ticketTypeName || ''}
              error={fieldErrors.ticketTypeName}
              onChange={(e) => updateField('ticketTypeName', e.target.value)}
              placeholder="General Admission"
            />
          </div>
          <div>
            <Label htmlFor="ticketPrice" required>Ticket Price</Label>
            <Input
              id="ticketPrice"
              type="number"
              min={0}
              step="0.01"
              value={form.ticketPrice || ''}
              error={fieldErrors.ticketPrice}
              onChange={(e) => updateField('ticketPrice', e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="ticketCurrency" required>Currency</Label>
            <select
              id="ticketCurrency"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={legacyTicketCurrency || form.ticketCurrency || DEFAULT_CURRENCY}
              onChange={(e) => updateField('ticketCurrency', normalizeTicketCurrency(e.target.value))}
            >
              {legacyTicketCurrency ? (
                <option value={legacyTicketCurrency}>{legacyTicketCurrency} (legacy unsupported)</option>
              ) : null}
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
            {legacyTicketCurrency ? (
              <p className="mt-1 text-sm text-amber-700">Select a supported currency before publishing.</p>
            ) : null}
            {fieldErrors.ticketCurrency ? <p className="mt-1 text-sm text-red-600">{fieldErrors.ticketCurrency}</p> : null}
          </div>
          <div>
            <Label htmlFor="ticketCapacity">Capacity (optional)</Label>
            <Input
              id="ticketCapacity"
              type="number"
              min={1}
              step={1}
              value={form.ticketCapacity || ''}
              error={fieldErrors.ticketCapacity}
              onChange={(e) => updateField('ticketCapacity', e.target.value)}
              placeholder="Leave empty for unlimited"
            />
          </div>
        </div>
      </section>

      <section className="space-y-5 border-b border-gray-300 pb-6">
        <h3 className="text-3xl font-semibold text-gray-900">Bottom Visual</h3>
        {bottomImageSrc ? (
          <div className="aspect-[16/9] overflow-hidden rounded-xl bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bottomImageSrc} alt="Event bottom visual" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
            No bottom image selected.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <input
            ref={bottomInputRef}
            id="bottomImageUpload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => onImageSelected(event, 'bottomImage')}
            className="hidden"
            disabled={isUploadingBottom}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => bottomInputRef.current?.click()}
            isLoading={isUploadingBottom}
          >
            Add bottom image
          </Button>
          {canEditBottomImage ? (
            <Button
              type="button"
              variant="outline"
              isLoading={isPreparingCrop === 'bottomImage'}
              onClick={() => {
                void openExistingCrop('bottomImage', bottomImageSrc)
              }}
            >
              Edit / Crop bottom image
            </Button>
          ) : null}
          {croppedImageFiles.bottomImage ? (
            <Button type="button" variant="outline" onClick={() => void resetImageToOriginal('bottomImage')}>
              Reset bottom image
            </Button>
          ) : null}
        </div>
        {fieldErrors.bottomImage ? <p className="text-sm text-red-600">{fieldErrors.bottomImage}</p> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={form.visibility}
              onChange={(e) => updateField('visibility', e.target.value as EventFormData['visibility'])}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cancellationDeadlineHours">Cancellation Deadline (hours)</Label>
            <Input
              id="cancellationDeadlineHours"
              type="number"
              min={0}
              value={form.cancellationDeadlineHours}
              onChange={(e) => updateField('cancellationDeadlineHours', Number(e.target.value))}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="categoryIds">Category IDs (comma separated)</Label>
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
          Cancel
        </Button>
        <Button onClick={() => submit('save')} isLoading={isSubmitting}>
          Save Draft
        </Button>
        <Button variant="outline" onClick={() => submit('publish')} isLoading={isSubmitting}>
          Save and Publish
        </Button>
      </div>

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

      <FloatingToast
        message={toast?.message || null}
        tone={toast?.tone || 'success'}
        onDismiss={() => setToast(null)}
      />
    </div>
  )
}
