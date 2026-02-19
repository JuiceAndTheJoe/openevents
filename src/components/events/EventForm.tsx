'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type EventFormMode = 'create' | 'edit'

type EventFormData = {
  id?: string
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
  visibility: 'PUBLIC' | 'PRIVATE'
  cancellationDeadlineHours: number
  categoryIds?: string[]
}

type EventFormProps = {
  mode: EventFormMode
  initialData?: EventFormData
}

const fallbackInitialData: EventFormData = {
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
  visibility: 'PUBLIC',
  cancellationDeadlineHours: 48,
  categoryIds: [],
}

function toDateTimeLocalString(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

export function EventForm({ mode, initialData }: EventFormProps) {
  const router = useRouter()
  const mergedInitialData = useMemo(() => ({ ...fallbackInitialData, ...initialData }), [initialData])

  const [form, setForm] = useState<EventFormData>({
    ...mergedInitialData,
    startDate: toDateTimeLocalString(mergedInitialData.startDate),
    endDate: toDateTimeLocalString(mergedInitialData.endDate),
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function uploadCoverImage(file: File) {
    if (!form.id && mode === 'edit') return

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
      throw new Error('Failed to upload cover image')
    }

    updateField('coverImage', publicUrl)
  }

  async function submit(action: 'save' | 'publish') {
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        onlineUrl: form.onlineUrl || null,
        coverImage: form.coverImage || null,
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
        throw new Error(eventJson?.error || 'Failed to save event')
      }

      const eventId = eventJson?.data?.id || form.id

      if (action === 'publish' && eventId) {
        const publishRes = await fetch(`/api/events/${eventId}/publish`, {
          method: 'POST',
        })

        const publishJson = await publishRes.json()
        if (!publishRes.ok) {
          throw new Error(publishJson?.error || 'Failed to publish event')
        }
      }

      if (eventId) {
        router.push(`/dashboard/events/${eventId}/edit`)
      } else {
        router.refresh()
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save event')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-gray-900">
        {mode === 'create' ? 'Create Event' : 'Edit Event'}
      </h2>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="title" required>Title</Label>
          <Input id="title" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={form.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="descriptionHtml">Rich Description (HTML supported)</Label>
          <textarea
            id="descriptionHtml"
            className="min-h-28 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
            value={form.descriptionHtml || ''}
            onChange={(e) => updateField('descriptionHtml', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="startDate" required>Start</Label>
          <Input id="startDate" type="datetime-local" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} />
        </div>
        <div>
          <Label htmlFor="endDate" required>End</Label>
          <Input id="endDate" type="datetime-local" value={form.endDate} onChange={(e) => updateField('endDate', e.target.value)} />
        </div>

        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} />
        </div>

        <div>
          <Label htmlFor="locationType">Location Type</Label>
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
              <Label htmlFor="venue">Venue</Label>
              <Input id="venue" value={form.venue || ''} onChange={(e) => updateField('venue', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="address">Address (Autocomplete)</Label>
              <Input id="address" list="address-suggestions" value={form.address || ''} onChange={(e) => updateField('address', e.target.value)} />
              <datalist id="address-suggestions">
                <option value="Main Street 1" />
                <option value="Conference Center Ave 10" />
                <option value="Innovation Plaza 5" />
              </datalist>
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city || ''} onChange={(e) => updateField('city', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state || ''} onChange={(e) => updateField('state', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country || ''} onChange={(e) => updateField('country', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input id="postalCode" value={form.postalCode || ''} onChange={(e) => updateField('postalCode', e.target.value)} />
            </div>
          </>
        ) : null}

        {(form.locationType === 'ONLINE' || form.locationType === 'HYBRID') ? (
          <div className="md:col-span-2">
            <Label htmlFor="onlineUrl">Online URL</Label>
            <Input id="onlineUrl" value={form.onlineUrl || ''} onChange={(e) => updateField('onlineUrl', e.target.value)} />
          </div>
        ) : null}

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

        <div className="md:col-span-2">
          <Label htmlFor="coverImage">Cover Image URL</Label>
          <Input id="coverImage" value={form.coverImage || ''} onChange={(e) => updateField('coverImage', e.target.value)} />
          <div className="mt-2 flex items-center gap-3">
            <input
              id="coverImageUpload"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  await uploadCoverImage(file)
                } catch (uploadError) {
                  setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
                }
              }}
              className="text-sm"
            />
            {form.coverImage ? <span className="text-xs text-green-700">Image ready</span> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => submit('save')} isLoading={isSubmitting}>
          Save Draft
        </Button>
        <Button variant="outline" onClick={() => submit('publish')} isLoading={isSubmitting}>
          Save and Publish
        </Button>
      </div>
    </div>
  )
}
