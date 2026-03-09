'use client'

import { useEffect, useRef } from 'react'
import { X, Calendar, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isValidTimeZone } from '@/lib/timezone'

type SpeakerPreview = {
  name: string
  title: string
  organization: string
  imageSrc: string | null
}

type EventPreviewData = {
  title: string
  description: string
  startDate: string
  endDate: string
  timezone: string
  locationType: 'PHYSICAL' | 'ONLINE' | 'HYBRID'
  venue: string
  address: string
  city: string
  state: string
  country: string
  coverImageSrc: string | null
  bottomImageSrc: string | null
  speakers: SpeakerPreview[]
  organizerName?: string
  minPrice?: number | null
  currency?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'
}

type EventPreviewModalProps = {
  open: boolean
  data: EventPreviewData
  onClose: () => void
}

export function EventPreviewModal({ open, data, onClose }: EventPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      const closeBtn = dialogRef.current?.querySelector<HTMLElement>('[data-close-btn]')
      closeBtn?.focus()
    } else {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const displayTimeZone = isValidTimeZone(data.timezone) ? data.timezone : 'UTC'

  const locationText = [data.venue, data.address, data.city, data.state, data.country]
    .filter(Boolean)
    .join(', ')

  let startDateLabel = ''
  let endDateLabel = ''
  let startTimeLabel = ''
  let endTimeLabel = ''
  let startDateKey = ''
  let endDateKey = ''

  try {
    const startDateObj = new Date(data.startDate)
    const endDateObj = new Date(data.endDate)

    if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
      startDateLabel = new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: displayTimeZone,
        day: 'numeric',
      }).format(startDateObj)
      endDateLabel = new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: displayTimeZone,
        day: 'numeric',
      }).format(endDateObj)
      startTimeLabel = new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: displayTimeZone,
      }).format(startDateObj)
      endTimeLabel = new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: displayTimeZone,
      }).format(endDateObj)
      startDateKey = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: displayTimeZone,
      }).format(startDateObj)
      endDateKey = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: displayTimeZone,
      }).format(endDateObj)
    }
  } catch {
    // Date parsing failed, leave labels empty
  }

  const isSameLocalDay = startDateKey === endDateKey
  const rightDateLabel = isSameLocalDay ? startDateLabel : `${startDateLabel} - ${endDateLabel}`
  const rightTimeLabel = startTimeLabel && endTimeLabel ? `${startTimeLabel} - ${endTimeLabel}` : ''
  const startDateTimeLabel = isSameLocalDay
    ? `${startDateLabel} at ${rightTimeLabel}`
    : `${startDateLabel} at ${startTimeLabel} - ${endDateLabel} at ${endTimeLabel}`

  const formattedMinPrice = data.minPrice !== null && data.minPrice !== undefined
    ? new Intl.NumberFormat('en', {
        style: 'currency',
        currency: data.currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(data.minPrice)
    : null

  const statusLabel = data.status === 'DRAFT' ? 'Draft' : data.status === 'PUBLISHED' ? 'Published' : data.status

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
      className="fixed inset-0 z-50 flex items-start justify-end"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div
        ref={dialogRef}
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 id="preview-dialog-title" className="text-lg font-semibold text-gray-900">
              Event Preview
            </h2>
            <p className="text-sm text-gray-500">
              This is how your event will appear to attendees
              {statusLabel && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {statusLabel}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            data-close-btn
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            {/* Cover image */}
            <section className="relative overflow-hidden rounded-2xl bg-gray-900">
              {data.coverImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.coverImageSrc}
                  alt={data.title}
                  className="h-[180px] w-full object-cover sm:h-[220px]"
                />
              ) : (
                <div className="h-[180px] bg-gradient-to-r from-slate-700 to-slate-900 sm:h-[220px]" />
              )}
            </section>

            {/* Event info */}
            <section className="border-b border-gray-200 pb-6">
              <div className="flex flex-col gap-4">
                <h1
                  className="text-3xl font-bold leading-tight text-black"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  {data.title || 'Untitled Event'}
                </h1>
                {data.organizerName && (
                  <p
                    className="text-base text-black"
                    style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                  >
                    By <span className="font-semibold">{data.organizerName}</span>
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {data.locationType !== 'ONLINE' ? (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-1 h-5 w-5 shrink-0 text-gray-600" />
                      <div className="flex flex-col">
                        {data.venue && (
                          <span className="text-base font-semibold text-gray-700">
                            {data.venue}
                          </span>
                        )}
                        {locationText && (
                          <span className="text-sm text-gray-500">
                            {locationText}
                          </span>
                        )}
                        {!data.venue && !locationText && (
                          <span className="text-base font-semibold text-gray-700">
                            Location TBD
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 shrink-0 text-gray-600" />
                      <span className="text-base font-semibold text-gray-700">
                        Online event
                      </span>
                    </div>
                  )}

                  {startDateTimeLabel && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 shrink-0 text-gray-600" />
                      <span className="text-sm text-gray-700">
                        {startDateTimeLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Price and date summary */}
                <div className="mt-2 rounded-lg bg-gray-50 p-4">
                  <p className="text-xl font-bold text-[#5c8bd9]">
                    {formattedMinPrice === null ? 'Free' : `From ${formattedMinPrice}`}
                  </p>
                  {rightDateLabel && (
                    <p className="mt-1 text-sm text-gray-600">{rightDateLabel}</p>
                  )}
                  {rightTimeLabel && (
                    <p className="text-sm text-gray-600">{rightTimeLabel}</p>
                  )}
                  <div className="mt-3">
                    <span className="flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-400">
                      Get tickets (preview only)
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Overview */}
            <section className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-bold text-black">Overview</h2>
              <div className="mt-3">
                {data.description?.trim() ? (
                  <p className="whitespace-pre-line text-base text-gray-700">
                    {data.description}
                  </p>
                ) : (
                  <p className="text-base italic text-gray-400">
                    No description provided yet.
                  </p>
                )}
              </div>
            </section>

            {/* Speakers */}
            {data.speakers.length > 0 && (
              <section className="border-b border-gray-200 pb-6">
                <h2 className="text-xl font-bold text-black">Speakers</h2>
                <div className="mt-4 flex flex-wrap gap-4">
                  {data.speakers.map((speaker, index) => (
                    <div
                      key={`speaker-preview-${index}`}
                      className="flex h-24 w-full max-w-[280px] items-center gap-3 rounded-xl bg-gray-50 px-4"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-200">
                        {speaker.imageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={speaker.imageSrc}
                            alt={speaker.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-bold text-gray-500">
                            {speaker.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-base font-semibold text-black">
                          {speaker.name}
                        </span>
                        {speaker.title && (
                          <span className="truncate text-sm text-gray-600">
                            {speaker.title}
                          </span>
                        )}
                        {speaker.organization && (
                          <span className="truncate text-xs text-gray-500">
                            {speaker.organization}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Bottom image */}
            {data.bottomImageSrc && (
              <section className="overflow-hidden rounded-xl bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.bottomImageSrc}
                  alt={`${data.title} visual`}
                  className="h-[160px] w-full object-cover sm:h-[200px]"
                />
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  )
}
