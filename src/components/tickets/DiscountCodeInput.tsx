'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface AppliedDiscount {
  id: string
  code: string
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_TICKET' | 'INVOICE'
  discountValue: number
  applicableTicketTypeIds: string[]
}

interface DiscountCodeInputProps {
  eventId: string
  selectedTicketTypeIds: string[]
  onDiscountChange: (discount: AppliedDiscount | null) => void
}

export function DiscountCodeInput({
  eventId,
  selectedTicketTypeIds,
  onDiscountChange,
}: DiscountCodeInputProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [appliedCode, setAppliedCode] = useState<string | null>(null)

  async function handleApply() {
    if (!code.trim()) {
      setError('Enter a discount code')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          code,
          ticketTypeIds: selectedTicketTypeIds,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        setError(data.reason || data.error || 'Invalid discount code')
        onDiscountChange(null)
        setAppliedCode(null)
        return
      }

      setAppliedCode(data.discount.code)
      onDiscountChange(data.discount as AppliedDiscount)
      setCode(data.discount.code)
    } catch (applyError) {
      console.error('Failed to validate discount code', applyError)
      setError('Could not validate discount code right now')
      onDiscountChange(null)
      setAppliedCode(null)
    } finally {
      setIsLoading(false)
    }
  }

  function handleClear() {
    setAppliedCode(null)
    setCode('')
    setError(null)
    onDiscountChange(null)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700" htmlFor="discount-code">
        Discount Code
      </label>
      <div className="flex gap-2">
        <Input
          id="discount-code"
          value={code}
          placeholder="Enter code"
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          disabled={isLoading || !!appliedCode}
        />
        {appliedCode ? (
          <Button type="button" variant="outline" onClick={handleClear}>
            Remove
          </Button>
        ) : (
          <Button type="button" onClick={handleApply} isLoading={isLoading}>
            Apply
          </Button>
        )}
      </div>
      {appliedCode && <p className="text-sm text-green-700">Code {appliedCode} applied.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
