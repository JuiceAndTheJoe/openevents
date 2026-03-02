'use client'

import { useState } from 'react'
import { DiscountType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DiscountCodeFormProps = {
  title: string
  submitLabel: string
  action: (formData: FormData) => Promise<void>
  initial?: {
    id: string
    code: string
    discountType: DiscountType
    discountValue: number
    maxUses: number | null
    isActive: boolean
  }
}

export function DiscountCodeForm({ title, submitLabel, action, initial }: DiscountCodeFormProps) {
  const [discountType, setDiscountType] = useState<DiscountType>(initial?.discountType || 'PERCENTAGE')

  const showValueField = discountType === 'PERCENTAGE' || discountType === 'FIXED_AMOUNT'
  const showMaxUsesField = discountType !== 'INVOICE'

  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {initial ? <input type="hidden" name="discountCodeId" value={initial.id} /> : null}
      <div>
        <Label htmlFor={`${title}-code`} required>Code</Label>
        <Input id={`${title}-code`} name="code" defaultValue={initial?.code || ''} required />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={`${title}-type`} required>Type</Label>
          <select
            id={`${title}-type`}
            name="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed Amount</option>
            <option value="FREE_TICKET">Free Ticket</option>
            <option value="INVOICE">Invoice</option>
          </select>
        </div>
        {showValueField && (
          <div>
            <Label htmlFor={`${title}-value`} required>
              {discountType === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount'}
            </Label>
            <Input
              id={`${title}-value`}
              name="discountValue"
              type="number"
              min="0"
              max={discountType === 'PERCENTAGE' ? '100' : undefined}
              step="0.01"
              defaultValue={initial?.discountValue ?? ''}
              required
            />
          </div>
        )}
        {showMaxUsesField && (
          <div>
            <Label htmlFor={`${title}-maxUses`}>Max discounted tickets (not orders)</Label>
            <Input id={`${title}-maxUses`} name="maxUses" type="number" min="1" defaultValue={initial?.maxUses ?? ''} />
          </div>
        )}
        <div>
          <Label htmlFor={`${title}-isActive`}>Status</Label>
          <select
            id={`${title}-isActive`}
            name="isActive"
            defaultValue={initial?.isActive === false ? 'false' : 'true'}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  )
}
