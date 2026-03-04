'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

export interface SelectableTicketType {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  minPerOrder: number
  maxPerOrder: number | null
  remaining: number | null
  sold: number
  isAvailable: boolean
}

interface TicketSelectorProps {
  ticketTypes: SelectableTicketType[]
  quantities: Record<string, number>
  onQuantityChange: (ticketTypeId: string, quantity: number) => void
}

const getTicketRemainingText = (remaining: number | null, isAvailable: boolean): string => {
  if (remaining === 0 || !isAvailable) return 'Sold out'
  if (remaining === null) return 'Tickets available'
  if (remaining < 20) return 'Few tickets left!'
  return 'Tickets available'
}

export function TicketSelector({
  ticketTypes,
  quantities,
  onQuantityChange,
}: TicketSelectorProps) {
  return (
    <div className="space-y-4">
      {ticketTypes.map((ticketType) => {
        const currentQuantity = quantities[ticketType.id] ?? 0
        const maxByCapacity = ticketType.remaining ?? Infinity
        const maxByOrder = ticketType.maxPerOrder ?? Infinity
        const maxSelectable = Math.min(maxByOrder, maxByCapacity)
        const canDecrease = currentQuantity > 0
        const canIncrease = ticketType.isAvailable && currentQuantity < maxSelectable

        return (
          <Card key={ticketType.id} className={!ticketType.isAvailable ? 'opacity-70' : ''}>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-gray-900">{ticketType.name}</h3>
                {ticketType.description && (
                  <p className="text-sm text-gray-600">{ticketType.description}</p>
                )}
                <p
                  className={`text-sm font-medium ${
                    ticketType.remaining !== null &&
                    ticketType.remaining > 0 &&
                    ticketType.remaining < 20
                      ? 'text-orange-600'
                      : 'text-gray-500'
                  }`}
                >
                  {getTicketRemainingText(ticketType.remaining, ticketType.isAvailable)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <p className="min-w-24 text-right font-semibold text-gray-900">
                  {formatCurrency(ticketType.price, ticketType.currency)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onQuantityChange(ticketType.id, Math.max(0, currentQuantity - 1))}
                    disabled={!canDecrease}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{currentQuantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onQuantityChange(ticketType.id, currentQuantity + 1)}
                    disabled={!canIncrease}
                  >
                    +
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
