'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface TicketScannerProps {
  eventId: string
}

type ScanResult = {
  valid: boolean
  message: string
  attendee?: string | null
  checkedInAt?: string | null
}

export function TicketScanner({ eventId }: TicketScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingRef = useRef(false)

  const verifyTicket = useCallback(async (code: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    try {
      const res = await fetch(`/api/tickets/verify/${encodeURIComponent(code)}`, {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok) {
        setResult({
          valid: true,
          message: 'Check-in successful',
          attendee: data.attendee,
          checkedInAt: data.checkedInAt,
        })
      } else {
        setResult({
          valid: false,
          message: data.error || 'Verification failed',
          attendee: data.attendee,
          checkedInAt: data.checkedInAt,
        })
      }
    } catch {
      setResult({
        valid: false,
        message: 'Network error - please try again',
      })
    }

    // Clear result after 3 seconds and allow next scan
    setTimeout(() => {
      setResult(null)
      isProcessingRef.current = false
    }, 3000)
  }, [])

  const startScanner = useCallback(async () => {
    setError(null)
    setResult(null)

    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          verifyTicket(decodedText)
        },
        () => {
          // Ignore scan failures (no QR found in frame)
        }
      )

      setIsScanning(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start camera'
      setError(message)
      setIsScanning(false)
    }
  }, [verifyTicket])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null
    }
    setIsScanning(false)
  }, [])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div
            id="qr-reader"
            className="mx-auto overflow-hidden rounded-lg"
            style={{ maxWidth: '400px' }}
          />

          {!isScanning && (
            <div className="mt-4 text-center">
              <Button onClick={startScanner} size="lg">
                Start Scanner
              </Button>
            </div>
          )}

          {isScanning && (
            <div className="mt-4 text-center">
              <Button onClick={stopScanner} variant="outline">
                Stop Scanner
              </Button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-center text-red-700">
              <p className="font-medium">Camera Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            result.valid
              ? 'border-green-500 bg-green-50'
              : 'border-red-500 bg-red-50'
          }
        >
          <CardContent className="p-6 text-center">
            <div
              className={`text-4xl ${result.valid ? 'text-green-600' : 'text-red-600'}`}
            >
              {result.valid ? '✓' : '✗'}
            </div>
            <p
              className={`mt-2 text-lg font-semibold ${result.valid ? 'text-green-700' : 'text-red-700'}`}
            >
              {result.message}
            </p>
            {result.attendee && (
              <p className="mt-1 text-gray-700">{result.attendee}</p>
            )}
            {result.checkedInAt && !result.valid && (
              <p className="mt-1 text-sm text-gray-500">
                Previously checked in at:{' '}
                {new Date(result.checkedInAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold">Manual Entry</h3>
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const input = form.elements.namedItem('ticketCode') as HTMLInputElement
              if (input.value.trim()) {
                await verifyTicket(input.value.trim())
                input.value = ''
              }
            }}
          >
            <input
              type="text"
              name="ticketCode"
              placeholder="Enter ticket code"
              className="flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <Button type="submit">Verify</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
