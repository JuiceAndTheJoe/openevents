'use client'

import { useState, useTransition } from 'react'

type Result = {
  scanned: number
  sent: number
  failed: number
}

type Props = {
  action: () => Promise<Result>
}

export function SendPendingRemindersButton({ action }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (result.scanned === 0) {
          setMessage('No pending orders older than 5 hours.')
        } else {
          setMessage(
            `Sent ${result.sent} reminder${result.sent === 1 ? '' : 's'}${
              result.failed > 0 ? ` (${result.failed} failed)` : ''
            }.`
          )
        }
      } catch (error) {
        console.error(error)
        setMessage('Failed to send reminders.')
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Sending…' : 'Send payment reminders'}
      </button>
      {message && <p className="text-xs text-gray-600">{message}</p>}
    </div>
  )
}
