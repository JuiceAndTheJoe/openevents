'use client'

import Link from 'next/link'
import { EventStatus } from '@prisma/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EventStatusBadge } from '@/components/dashboard/EventStatusBadge'
import { useToast } from '@/components/ui/toaster'
import { formatDateTime } from '@/lib/utils'

type EventsTableProps = {
  events: Array<{
    id: string
    slug: string
    title: string
    startDate: Date
    endDate: Date
    status: EventStatus
    visibility: 'PUBLIC' | 'PRIVATE'
    _count: {
      orders: number
      ticketTypes: number
    }
  }>
}

type ErrorAction = {
  label: string
  href: string
}

type UiActionError = {
  message: string
  action?: ErrorAction
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseUiActionError(payload: unknown, fallbackMessage: string): UiActionError {
  if (!isRecord(payload)) return { message: fallbackMessage }

  const messageValue = payload.message ?? payload.error
  const message =
    typeof messageValue === 'string' && messageValue.trim().length > 0
      ? messageValue
      : fallbackMessage

  const actionValue = payload.action
  if (!isRecord(actionValue)) return { message }

  const label = actionValue.label
  const href = actionValue.href
  if (typeof label !== 'string' || typeof href !== 'string') {
    return { message }
  }

  if (!href.startsWith('/')) return { message }

  return {
    message,
    action: { label, href },
  }
}

export function EventsTable({ events }: EventsTableProps) {
  const router = useRouter()
  const showToast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [pendingCancel, setPendingCancel] = useState<{ id: string; title: string } | null>(null)

  async function runAction(eventId: string, action: 'publish' | 'cancel') {
    setBusyId(eventId)
    const actionLabel = action === 'publish' ? 'publish' : 'cancel'

    try {
      const endpoint = action === 'publish' ? `/api/events/${eventId}/publish` : `/api/events/${eventId}/cancel`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'cancel' ? JSON.stringify({}) : undefined,
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        const { message } = parseUiActionError(
          json,
          `Could not ${actionLabel} the event due to a system error. Please try again.`
        )
        showToast(message, 'error')
        return
      }
      router.refresh()
      showToast(action === 'publish' ? 'Event published successfully' : 'Event cancelled')
    } catch (actionError) {
      console.error(`Failed to ${action} event`, actionError)
      showToast(`Could not ${actionLabel} the event due to a system error. Please try again.`, 'error')
    } finally {
      setBusyId(null)
      setPendingCancel(null)
    }
  }

  async function deleteEvent(eventId: string) {
    setBusyId(eventId)

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        const { message } = parseUiActionError(
          json,
          'Could not delete the event due to a system error. Please try again.'
        )
        showToast(message, 'error')
        return
      }
      router.refresh()
      showToast('Event deleted')
    } catch (deleteError) {
      console.error('Failed to delete event', deleteError)
      showToast('Could not delete the event due to a system error. Please try again.', 'error')
    } finally {
      setBusyId(null)
      setPendingDelete(null)
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-600">
        No events match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Event</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Orders</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tickets</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.visibility}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{formatDateTime(event.startDate)}</td>
                <td className="px-4 py-3"><EventStatusBadge status={event.status === 'PUBLISHED' && new Date(event.endDate) < new Date() ? 'PASSED' : event.status} /></td>
                <td className="px-4 py-3 text-gray-700">{event._count.orders}</td>
                <td className="px-4 py-3 text-gray-700">{event._count.ticketTypes}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link href={`/dashboard/events/${event.id}/edit`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    {event.status !== 'DRAFT' ? (
                      <Link href={`/dashboard/events/${event.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    ) : null}
                    {event.status !== 'DRAFT' && event.status !== 'CANCELLED' ? (
                      <Link href={`/dashboard/events/${event.id}/scan`}>
                        <Button size="sm">Scan</Button>
                      </Link>
                    ) : null}
                    {event.status === 'DRAFT' ? (
                      <Button size="sm" isLoading={busyId === event.id} onClick={() => runAction(event.id, 'publish')}>
                        Publish
                      </Button>
                    ) : null}
                    {event.status === 'PUBLISHED' ? (
                      <Button variant="cancel" size="sm" isLoading={busyId === event.id} onClick={() => setPendingCancel({ id: event.id, title: event.title })}>
                        Cancel
                      </Button>
                    ) : null}
                    {event.status === 'CANCELLED' || event.status === 'DRAFT' ? (
                      <Button variant="destructive" size="sm" isLoading={busyId === event.id} onClick={() => setPendingDelete({ id: event.id, title: event.title })}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingCancel !== null}
        title={`Cancel "${pendingCancel?.title}"?`}
        description="This will cancel the event and notify all ticket holders. This action cannot be undone."
        confirmLabel="Cancel Event"
        isLoading={busyId === pendingCancel?.id}
        onConfirm={() => {
          if (pendingCancel) runAction(pendingCancel.id, 'cancel')
        }}
        onClose={() => setPendingCancel(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.title}"?`}
        description="This will permanently delete the event and all associated ticket types. This cannot be undone."
        confirmLabel="Delete Event"
        isLoading={busyId === pendingDelete?.id}
        onConfirm={() => pendingDelete && deleteEvent(pendingDelete.id)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
