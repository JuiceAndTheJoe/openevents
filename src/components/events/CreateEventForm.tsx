'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CategoryOption = {
  id: string
  name: string
}

type CreateEventFormProps = {
  categories: CategoryOption[]
}

type LocationType = 'PHYSICAL' | 'ONLINE' | 'HYBRID'

const initialState = {
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  locationType: 'PHYSICAL' as LocationType,
  venue: '',
  city: '',
  country: '',
  onlineUrl: '',
  description: '',
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString()
}

export function CreateEventForm({ categories }: CreateEventFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(initialState)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validateForm() {
    if (!form.title.trim()) return 'Event title is required.'
    if (!form.description.trim()) return 'Event description is required.'
    if (!form.date || !form.startTime || !form.endTime) return 'Date, start time, and end time are required.'
    if (toIso(form.date, form.endTime) <= toIso(form.date, form.startTime)) {
      return 'End time must be after start time.'
    }
    if (form.locationType !== 'ONLINE' && (!form.venue.trim() || !form.city.trim() || !form.country.trim())) {
      return 'Venue, city, and country are required for physical or hybrid events.'
    }
    if ((form.locationType === 'ONLINE' || form.locationType === 'HYBRID') && !form.onlineUrl.trim()) {
      return 'An online URL is required for online or hybrid events.'
    }

    return null
  }

  async function onSubmit(action: 'save' | 'publish') {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

      const payload = {
        title: form.title,
        description: form.description,
        startDate: toIso(form.date, form.startTime),
        endDate: toIso(form.date, form.endTime),
        timezone,
        locationType: form.locationType,
        venue: form.locationType === 'ONLINE' ? null : form.venue,
        city: form.locationType === 'ONLINE' ? null : form.city,
        country: form.locationType === 'ONLINE' ? null : form.country,
        onlineUrl: form.locationType === 'PHYSICAL' ? null : form.onlineUrl,
        visibility: 'PUBLIC',
        cancellationDeadlineHours: 48,
        categoryIds: selectedCategoryIds,
        autoCreateFreeTicket: true,
      }

      const eventRes = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const eventJson = await eventRes.json()

      if (!eventRes.ok) {
        throw new Error(eventJson?.error || 'Failed to create event')
      }

      const eventId = eventJson?.data?.id as string | undefined

      if (!eventId) {
        throw new Error('Event created without an id')
      }

      if (action === 'publish') {
        const publishRes = await fetch(`/api/events/${eventId}/publish`, {
          method: 'POST',
        })

        const publishJson = await publishRes.json()

        if (!publishRes.ok) {
          throw new Error(publishJson?.error || 'Failed to publish event')
        }

        router.push('/?published=1')
        return
      }

      router.push(`/dashboard/events/${eventId}/edit`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl rounded-2xl border border-gray-200 bg-white px-6 py-8 sm:px-10">
      <h1 className="text-4xl font-semibold text-gray-900">Create Event</h1>
      <p className="mt-2 text-sm text-gray-600">Add your event details and publish it to the homepage.</p>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mt-8 space-y-10">
        <section className="space-y-4">
          <h2 className="text-3xl font-medium text-gray-900">Event Details</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title" required>Event Title</Label>
              <Input
                id="title"
                placeholder="Enter the name of your event"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="tags">Event Tags</Label>
              <select
                id="tags"
                multiple
                value={selectedCategoryIds}
                onChange={(e) => {
                  const ids = Array.from(e.target.selectedOptions).map((option) => option.value).slice(0, 4)
                  setSelectedCategoryIds(ids)
                }}
                className="h-32 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Select up to 4 categories.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-medium text-gray-900">Date &amp; Time</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="date" required>Date</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="startTime" required>Start Time</Label>
              <Input id="startTime" type="time" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="endTime" required>End Time</Label>
              <Input id="endTime" type="time" value={form.endTime} onChange={(e) => updateField('endTime', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-medium text-gray-900">Location</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="locationType" required>Where will your event take place?</Label>
              <select
                id="locationType"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={form.locationType}
                onChange={(e) => updateField('locationType', e.target.value as LocationType)}
              >
                <option value="PHYSICAL">Physical</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>

            {form.locationType !== 'ONLINE' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="venue" required>Venue</Label>
                  <Input id="venue" value={form.venue} onChange={(e) => updateField('venue', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="city" required>City</Label>
                  <Input id="city" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="country" required>Country</Label>
                  <Input id="country" value={form.country} onChange={(e) => updateField('country', e.target.value)} />
                </div>
              </div>
            ) : null}

            {(form.locationType === 'ONLINE' || form.locationType === 'HYBRID') ? (
              <div>
                <Label htmlFor="onlineUrl" required>Online URL</Label>
                <Input
                  id="onlineUrl"
                  type="url"
                  placeholder="https://"
                  value={form.onlineUrl}
                  onChange={(e) => updateField('onlineUrl', e.target.value)}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-medium text-gray-900">Additional Information</h2>
          <div>
            <Label htmlFor="description" required>Event Description</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="min-h-44 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Describe what's special about your event and other important details."
            />
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => onSubmit('save')} isLoading={isSubmitting}>Save Draft</Button>
        <Button onClick={() => onSubmit('publish')} isLoading={isSubmitting}>Publish Event</Button>
      </div>
    </div>
  )
}
