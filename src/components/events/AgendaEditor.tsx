'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AgendaItem = {
  id: string
  title: string
  description: string | null
  startTime: string | Date
  endTime: string | Date | null
  speakerId: string | null
  sortOrder: number
}

type SpeakerOption = {
  id: string
  name: string
}

type AgendaEditorProps = {
  eventId: string
  initialItems: AgendaItem[]
  speakers: SpeakerOption[]
}

function asDateTimeLocal(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

export function AgendaEditor({ eventId, initialItems, speakers }: AgendaEditorProps) {
  const [items, setItems] = useState<AgendaItem[]>([...initialItems].sort((a, b) => a.sortOrder - b.sortOrder))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    speakerId: '',
  })

  async function createItem() {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/events/${eventId}/agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          startTime: new Date(newItem.startTime).toISOString(),
          endTime: newItem.endTime ? new Date(newItem.endTime).toISOString() : null,
          speakerId: newItem.speakerId || null,
          sortOrder: items.length,
        }),
      })

      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to create agenda item')
      }

      setItems((current) => [...current, json.data])
      setNewItem({ title: '', description: '', startTime: '', endTime: '', speakerId: '' })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create agenda item')
    } finally {
      setIsSaving(false)
    }
  }

  async function removeItem(itemId: string) {
    const response = await fetch(`/api/events/${eventId}/agenda/${itemId}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      setItems((current) => current.filter((item) => item.id !== itemId))
    }
  }

  async function moveItem(itemId: string, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = sorted.findIndex((item) => item.id === itemId)
    const nextIndex = index + direction

    if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return

    const current = sorted[index]
    const next = sorted[nextIndex]

    await Promise.all([
      fetch(`/api/events/${eventId}/agenda/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: next.sortOrder }),
      }),
      fetch(`/api/events/${eventId}/agenda/${next.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: current.sortOrder }),
      }),
    ])

    setItems((currentItems) => {
      const mapped = currentItems.map((item) => {
        if (item.id === current.id) return { ...item, sortOrder: next.sortOrder }
        if (item.id === next.id) return { ...item, sortOrder: current.sortOrder }
        return item
      })
      return mapped.sort((a, b) => a.sortOrder - b.sortOrder)
    })
  }

  async function moveItemToTarget(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
    const dragged = sorted.find((item) => item.id === draggedId)
    const target = sorted.find((item) => item.id === targetId)
    if (!dragged || !target) return

    await Promise.all([
      fetch(`/api/events/${eventId}/agenda/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: target.sortOrder }),
      }),
      fetch(`/api/events/${eventId}/agenda/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: dragged.sortOrder }),
      }),
    ])

    setItems((currentItems) =>
      currentItems
        .map((item) => {
          if (item.id === dragged.id) return { ...item, sortOrder: target.sortOrder }
          if (item.id === target.id) return { ...item, sortOrder: dragged.sortOrder }
          return item
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Agenda Editor</h3>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input placeholder="Agenda title" value={newItem.title} onChange={(e) => setNewItem((x) => ({ ...x, title: e.target.value }))} />
        <select className="h-10 rounded-md border border-gray-300 px-3 text-sm" value={newItem.speakerId} onChange={(e) => setNewItem((x) => ({ ...x, speakerId: e.target.value }))}>
          <option value="">No speaker</option>
          {speakers.map((speaker) => (
            <option key={speaker.id} value={speaker.id}>{speaker.name}</option>
          ))}
        </select>
        <Input type="datetime-local" value={newItem.startTime} onChange={(e) => setNewItem((x) => ({ ...x, startTime: e.target.value }))} />
        <Input type="datetime-local" value={newItem.endTime} onChange={(e) => setNewItem((x) => ({ ...x, endTime: e.target.value }))} />
        <textarea className="min-h-20 rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={newItem.description} onChange={(e) => setNewItem((x) => ({ ...x, description: e.target.value }))} />
        <div className="md:col-span-2">
          <Button onClick={createItem} isLoading={isSaving}>Add Agenda Item</Button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDragItemId(item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={async () => {
              if (dragItemId) {
                await moveItemToTarget(dragItemId, item.id)
                setDragItemId(null)
              }
            }}
            className="flex cursor-move flex-col gap-2 rounded-md border border-gray-200 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-gray-600">
                  {asDateTimeLocal(item.startTime)} {item.endTime ? `- ${asDateTimeLocal(item.endTime)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => moveItem(item.id, -1)}>Up</Button>
                <Button size="sm" variant="outline" onClick={() => moveItem(item.id, 1)}>Down</Button>
                <Button size="sm" variant="destructive" onClick={() => removeItem(item.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
