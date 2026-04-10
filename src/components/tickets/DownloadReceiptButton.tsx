'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DownloadReceiptButtonProps {
  orderNumber: string
}

export function DownloadReceiptButton({ orderNumber }: DownloadReceiptButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/orders/by-number/${encodeURIComponent(orderNumber)}/receipt`
      )
      if (!res.ok) {
        let message = 'Failed to download receipt'
        try {
          const data = await res.json()
          if (data?.error) message = data.error
        } catch {
          // response was not JSON; keep default message
        }
        throw new Error(message)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `receipt-${orderNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download receipt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
        )}
        {loading ? 'Generating…' : 'Download Receipt'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
