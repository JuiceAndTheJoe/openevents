'use client'

import { useEffect, useMemo, useState } from 'react'

type FloatingToastProps = {
  message: string | null
  tone?: 'success' | 'error'
  durationMs?: number
  onDismiss?: () => void
}

export function FloatingToast({ message, tone = 'success', durationMs = 3500, onDismiss }: FloatingToastProps) {
  const [visibleMessage, setVisibleMessage] = useState<string | null>(message)

  useEffect(() => {
    setVisibleMessage(message)
  }, [message])

  useEffect(() => {
    if (!visibleMessage) return
    const timeout = window.setTimeout(() => {
      setVisibleMessage(null)
      onDismiss?.()
    }, durationMs)

    return () => window.clearTimeout(timeout)
  }, [visibleMessage, durationMs, onDismiss])

  const styles = useMemo(() => {
    if (tone === 'error') {
      return 'border-red-200 bg-red-50 text-red-700'
    }

    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }, [tone])

  if (!visibleMessage) return null

  return (
    <div className={`fixed bottom-5 right-5 z-50 rounded-md border px-4 py-3 text-sm shadow-lg ${styles}`}>
      {visibleMessage}
    </div>
  )
}
