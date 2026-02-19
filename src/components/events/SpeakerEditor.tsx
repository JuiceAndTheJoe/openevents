'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Speaker = {
  id: string
  name: string
  title: string | null
  bio: string | null
  photo: string | null
  sortOrder: number
}

type SpeakerEditorProps = {
  eventId: string
  initialSpeakers: Speaker[]
}

export function SpeakerEditor({ eventId, initialSpeakers }: SpeakerEditorProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([...initialSpeakers].sort((a, b) => a.sortOrder - b.sortOrder))
  const [newSpeaker, setNewSpeaker] = useState({
    name: '',
    title: '',
    bio: '',
    photo: '',
    email: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [dragSpeakerId, setDragSpeakerId] = useState<string | null>(null)

  async function createSpeaker() {
    setError(null)
    const response = await fetch(`/api/events/${eventId}/speakers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newSpeaker,
        photo: newSpeaker.photo || null,
        email: newSpeaker.email || null,
        sortOrder: speakers.length,
      }),
    })

    const json = await response.json()
    if (!response.ok) {
      setError(json?.error || 'Failed to create speaker')
      return
    }

    setSpeakers((current) => [...current, json.data])
    setNewSpeaker({ name: '', title: '', bio: '', photo: '', email: '' })
  }

  async function removeSpeaker(speakerId: string) {
    const response = await fetch(`/api/events/${eventId}/speakers/${speakerId}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      setSpeakers((current) => current.filter((speaker) => speaker.id !== speakerId))
    }
  }

  async function moveSpeaker(speakerId: string, direction: -1 | 1) {
    const sorted = [...speakers].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = sorted.findIndex((speaker) => speaker.id === speakerId)
    const nextIndex = index + direction

    if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return

    const current = sorted[index]
    const next = sorted[nextIndex]

    await Promise.all([
      fetch(`/api/events/${eventId}/speakers/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: next.sortOrder }),
      }),
      fetch(`/api/events/${eventId}/speakers/${next.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: current.sortOrder }),
      }),
    ])

    setSpeakers((currentSpeakers) => {
      const mapped = currentSpeakers.map((speaker) => {
        if (speaker.id === current.id) return { ...speaker, sortOrder: next.sortOrder }
        if (speaker.id === next.id) return { ...speaker, sortOrder: current.sortOrder }
        return speaker
      })

      return mapped.sort((a, b) => a.sortOrder - b.sortOrder)
    })
  }

  async function moveSpeakerToTarget(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    const sorted = [...speakers].sort((a, b) => a.sortOrder - b.sortOrder)
    const dragged = sorted.find((speaker) => speaker.id === draggedId)
    const target = sorted.find((speaker) => speaker.id === targetId)
    if (!dragged || !target) return

    await Promise.all([
      fetch(`/api/events/${eventId}/speakers/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: target.sortOrder }),
      }),
      fetch(`/api/events/${eventId}/speakers/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: dragged.sortOrder }),
      }),
    ])

    setSpeakers((currentSpeakers) =>
      currentSpeakers
        .map((speaker) => {
          if (speaker.id === dragged.id) return { ...speaker, sortOrder: target.sortOrder }
          if (speaker.id === target.id) return { ...speaker, sortOrder: dragged.sortOrder }
          return speaker
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Speaker Editor</h3>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input placeholder="Speaker name" value={newSpeaker.name} onChange={(e) => setNewSpeaker((x) => ({ ...x, name: e.target.value }))} />
        <Input placeholder="Title" value={newSpeaker.title} onChange={(e) => setNewSpeaker((x) => ({ ...x, title: e.target.value }))} />
        <Input placeholder="Email" value={newSpeaker.email} onChange={(e) => setNewSpeaker((x) => ({ ...x, email: e.target.value }))} />
        <Input placeholder="Photo URL" value={newSpeaker.photo} onChange={(e) => setNewSpeaker((x) => ({ ...x, photo: e.target.value }))} />
        <textarea className="min-h-20 rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Bio" value={newSpeaker.bio} onChange={(e) => setNewSpeaker((x) => ({ ...x, bio: e.target.value }))} />
        <div className="md:col-span-2">
          <Button onClick={createSpeaker}>Add Speaker</Button>
        </div>
      </div>

      <div className="space-y-3">
        {speakers.map((speaker) => (
          <article
            key={speaker.id}
            draggable
            onDragStart={() => setDragSpeakerId(speaker.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={async () => {
              if (dragSpeakerId) {
                await moveSpeakerToTarget(dragSpeakerId, speaker.id)
                setDragSpeakerId(null)
              }
            }}
            className="flex cursor-move items-center justify-between rounded-md border border-gray-200 p-3"
          >
            <div>
              <p className="font-semibold text-gray-900">{speaker.name}</p>
              {speaker.title ? <p className="text-sm text-gray-600">{speaker.title}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => moveSpeaker(speaker.id, -1)}>Up</Button>
              <Button size="sm" variant="outline" onClick={() => moveSpeaker(speaker.id, 1)}>Down</Button>
              <Button size="sm" variant="destructive" onClick={() => removeSpeaker(speaker.id)}>Delete</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
