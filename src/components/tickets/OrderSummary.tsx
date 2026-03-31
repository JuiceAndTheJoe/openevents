'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export interface SummaryLineItem {
  ticketTypeId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  currency: string
}

interface OrderSummaryProps {
  items: SummaryLineItem[]
  subtotal: number
  discountAmount: number
  totalAmount: number
  includedVat: number
  vatRate: number
  currency: string
  discountCode?: string | null
  groupDiscountMessage?: string | null
  freeOrderMessage?: string | null
}

export function OrderSummary({
  items,
  subtotal,
  discountAmount,
  totalAmount,
  includedVat,
  vatRate,
  currency,
  discountCode,
  groupDiscountMessage,
  freeOrderMessage,
}: OrderSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Select tickets to see your summary.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.ticketTypeId} className="flex items-start justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-gray-500">
                    {item.quantity} x {formatCurrency(item.unitPrice, item.currency)}
                  </p>
                </div>
                <p className="font-medium text-gray-900">
                  {formatCurrency(item.totalPrice, item.currency)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-gray-200 pt-3 text-sm">
          <div className="flex items-center justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>

          {freeOrderMessage && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-700">{freeOrderMessage}</p>
            </div>
          )}

          {!freeOrderMessage && discountAmount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-green-700">
                <span>
                  {discountCode
                    ? `Discount (${discountCode})`
                    : groupDiscountMessage
                      ? 'Group Discount'
                      : 'Discount'}
                </span>
                <span>-{formatCurrency(discountAmount, currency)}</span>
              </div>
              {groupDiscountMessage && (
                <p className="text-xs text-green-600">{groupDiscountMessage}</p>
              )}
              {groupDiscountMessage && subtotal > 0 && (
                <div className="mt-1 space-y-0.5">
                  {items.map((item) => {
                    const discountedUnit = item.unitPrice * (1 - discountAmount / subtotal)
                    return (
                      <p key={item.ticketTypeId} className="text-xs text-green-600">
                        {item.name}: {formatCurrency(discountedUnit, currency)} per ticket after discount
                      </p>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(totalAmount, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>VAT ({Math.round(vatRate * 100)}%)</span>
            <span>{formatCurrency(includedVat, currency)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
