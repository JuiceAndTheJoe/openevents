'use client'

import { Button } from '@/components/ui/button'

export function DownloadTicketsButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      Download Tickets as PDF
    </Button>
  )
}
