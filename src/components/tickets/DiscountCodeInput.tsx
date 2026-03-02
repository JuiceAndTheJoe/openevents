'use client'

import { useEffect, useMemo, useState } from 'react'
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
  ticketQuantities: Record<string, number>
  onDiscountChange: (discount: AppliedDiscount | null) => void
}

export function DiscountCodeInput({
  eventId,
  selectedTicketTypeIds,
  ticketQuantities,
  onDiscountChange,
}: DiscountCodeInputProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [appliedCartSignature, setAppliedCartSignature] = useState<string | null>(null)

  const cartSignature = useMemo(() => {
    const ticketTypeKey = [...selectedTicketTypeIds].sort().join('|')
    const quantityKey = Object.entries(ticketQuantities)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ticketTypeId, quantity]) => `${ticketTypeId}:${quantity}`)
      .join('|')

    return `${ticketTypeKey}::${quantityKey}`
  }, [selectedTicketTypeIds, ticketQuantities])

  function clearAppliedDiscount(options?: { clearInput?: boolean; message?: string | null }) {
    setAppliedCode(null)
    setAppliedCartSignature(null)
    onDiscountChange(null)

    if (options && 'message' in options) {
      setError(options.message ?? null)
    }

    if (options?.clearInput) {
      setCode('')
    }
  }

  useEffect(() => {
    if (!appliedCode || !appliedCartSignature || appliedCartSignature === cartSignature) {
      return
    }

    setAppliedCode(null)
    setAppliedCartSignature(null)
    setError('Cart changed. Reapply the discount code for the updated ticket quantity.')
    onDiscountChange(null)
  }, [appliedCode, appliedCartSignature, cartSignature, onDiscountChange])

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
          ticketQuantities,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        clearAppliedDiscount({
          message: data.reason || data.error || 'Invalid discount code',
        })
        return
      }

      setAppliedCode(data.discount.code)
      setAppliedCartSignature(cartSignature)
      onDiscountChange(data.discount as AppliedDiscount)
      setCode(data.discount.code)
    } catch (applyError) {
      console.error('Failed to validate discount code', applyError)
      clearAppliedDiscount({
        message: 'Could not validate discount code right now',
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleClear() {
    clearAppliedDiscount({ clearInput: true, message: null })
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
