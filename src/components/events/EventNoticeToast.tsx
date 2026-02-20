'use client'

import { FloatingToast } from '@/components/ui/floating-toast'

type EventNoticeToastProps = {
  message: string | null
}

export function EventNoticeToast({ message }: EventNoticeToastProps) {
  if (!message) return null

  return (
    <FloatingToast
      message={message}
      tone="success"
      durationMs={4000}
    />
  )
}
