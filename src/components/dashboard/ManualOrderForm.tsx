'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DiscountCodeInput, type AppliedDiscount } from '@/components/tickets/DiscountCodeInput'
import { TicketSelector, type SelectableTicketType } from '@/components/tickets/TicketSelector'
import { formatCurrency } from '@/lib/utils'
import { getIncludedVatFromVatInclusiveTotal } from '@/lib/pricing/vat'

interface GroupDiscount {
  id: string
  ticketTypeId: string | null
  minQuantity: number
  discountType: string
  discountValue: number
}

interface ManualOrderFormProps {
  event: {
    id: string
    title: string
  }
  ticketTypes: SelectableTicketType[]
  groupDiscounts?: GroupDiscount[]
}

interface BuyerFormState {
  firstName: string
  lastName: string
  email: string
  title: string
  organization: string
  address: string
  city: string
  postalCode: string
  country: string
}

interface AttendeeFormState {
  firstName: string
  lastName: string
  email: string
  title: string
  organization: string
}

function emptyAttendee(): AttendeeFormState {
  return { firstName: '', lastName: '', email: '', title: '', organization: '' }
}

interface SummaryLineItem {
  ticketTypeId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  currency: string
}

function calculateBestGroupDiscount(
  selectedItems: SummaryLineItem[],
  groupDiscounts: GroupDiscount[]
): { amount: number; description: string | null; id: string | null } {
  if (!groupDiscounts || groupDiscounts.length === 0) {
    return { amount: 0, description: null, id: null }
  }

  let bestDiscount = 0
  let bestDescription: string | null = null
  let bestId: string | null = null

  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0)

  // Check discounts that apply to all ticket types (ticketTypeId = null)
  const globalDiscounts = groupDiscounts
    .filter((gd) => gd.ticketTypeId === null && totalQuantity >= gd.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)

  if (globalDiscounts.length > 0) {
    const topGlobalDiscount = globalDiscounts[0]
    const subtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)

    let discountAmount = 0
    if (topGlobalDiscount.discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * topGlobalDiscount.discountValue) / 100
    } else if (topGlobalDiscount.discountType === 'FIXED') {
      discountAmount = topGlobalDiscount.discountValue
    }

    if (discountAmount > bestDiscount) {
      bestDiscount = discountAmount
      bestId = topGlobalDiscount.id
      bestDescription = `Buy ${topGlobalDiscount.minQuantity}+ tickets, get ${
        topGlobalDiscount.discountType === 'PERCENTAGE'
          ? `${topGlobalDiscount.discountValue}%`
          : `${topGlobalDiscount.discountValue} SEK`
      } off!`
    }
  }

  // Check discounts specific to ticket types
  for (const item of selectedItems) {
    const ticketDiscounts = groupDiscounts
      .filter((gd) => gd.ticketTypeId === item.ticketTypeId && item.quantity >= gd.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)

    if (ticketDiscounts.length > 0) {
      const topTicketDiscount = ticketDiscounts[0]

      let discountAmount = 0
      if (topTicketDiscount.discountType === 'PERCENTAGE') {
        discountAmount = (item.totalPrice * topTicketDiscount.discountValue) / 100
      } else if (topTicketDiscount.discountType === 'FIXED') {
        discountAmount = topTicketDiscount.discountValue
      }

      if (discountAmount > bestDiscount) {
        bestDiscount = discountAmount
        bestId = topTicketDiscount.id
        bestDescription = `Buy ${topTicketDiscount.minQuantity}+ ${item.name} tickets, get ${
          topTicketDiscount.discountType === 'PERCENTAGE'
            ? `${topTicketDiscount.discountValue}%`
            : `${topTicketDiscount.discountValue} SEK`
        } off!`
      }
    }
  }

  return {
    amount: Number(Math.min(bestDiscount, selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)).toFixed(2)),
    description: bestDescription,
    id: bestId,
  }
}

function calculatePromoCodeDiscountAmount(
  subtotal: number,
  discount: AppliedDiscount | null,
  selectedItems: SummaryLineItem[]
): number {
  if (!discount) return 0

  const appliesToAll = discount.applicableTicketTypeIds.length === 0
  const applicableItems = selectedItems
    .filter((item) => appliesToAll || discount.applicableTicketTypeIds.includes(item.ticketTypeId))

  let discountableSubtotal: number
  if (discount.applyToWholeOrder) {
    discountableSubtotal = applicableItems.reduce((sum, item) => sum + item.totalPrice, 0)
  } else {
    const maxUnitPrice = Math.max(0, ...applicableItems.map((item) => item.unitPrice))
    discountableSubtotal = maxUnitPrice
  }

  if (discount.discountType === 'PERCENTAGE') {
    return Number(Math.min(discountableSubtotal, (discountableSubtotal * discount.discountValue) / 100).toFixed(2))
  }

  if (discount.discountType === 'FIXED_AMOUNT') {
    return Number(Math.min(discountableSubtotal, discount.discountValue).toFixed(2))
  }

  if (discount.discountType === 'FREE_TICKET') {
    return Number(discountableSubtotal.toFixed(2))
  }

  return 0
}

export function ManualOrderForm({ event, ticketTypes, groupDiscounts = [] }: ManualOrderFormProps) {
  const router = useRouter()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null)

  const [attendeesByType, setAttendeesByType] = useState<Record<string, AttendeeFormState[]>>({})

  const [buyer, setBuyer] = useState<BuyerFormState>({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    organization: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
  })

  const selectedItems = useMemo<SummaryLineItem[]>(() => {
    return ticketTypes
      .map((ticketType) => {
        const quantity = quantities[ticketType.id] ?? 0
        if (quantity === 0) return null

        return {
          ticketTypeId: ticketType.id,
          name: ticketType.name,
          quantity,
          unitPrice: ticketType.price,
          totalPrice: Number((ticketType.price * quantity).toFixed(2)),
          currency: ticketType.currency,
        }
      })
      .filter((item): item is SummaryLineItem => item !== null)
  }, [quantities, ticketTypes])

  const subtotal = useMemo(
    () => Number(selectedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)),
    [selectedItems]
  )

  const selectedTicketTypeIds = useMemo(
    () => selectedItems.map((item) => item.ticketTypeId),
    [selectedItems]
  )

  // Calculate group discount
  const groupDiscount = useMemo(
    () => calculateBestGroupDiscount(selectedItems, groupDiscounts),
    [selectedItems, groupDiscounts]
  )

  // Calculate promo code discount
  const promoCodeDiscountAmount = useMemo(
    () => calculatePromoCodeDiscountAmount(subtotal, discount, selectedItems),
    [subtotal, discount, selectedItems]
  )

  // Apply the best discount: group discount vs promo code
  const discountAmount = useMemo(
    () => Math.max(groupDiscount.amount, promoCodeDiscountAmount),
    [groupDiscount.amount, promoCodeDiscountAmount]
  )

  const appliedDiscountType = useMemo(() => {
    if (discountAmount === 0) return null
    if (groupDiscount.amount > promoCodeDiscountAmount) return 'group'
    return 'promo'
  }, [discountAmount, groupDiscount.amount, promoCodeDiscountAmount])

  const totalAmount = useMemo(
    () => Number(Math.max(0, subtotal - discountAmount).toFixed(2)),
    [subtotal, discountAmount]
  )

  const includedVat = useMemo(
    () => getIncludedVatFromVatInclusiveTotal(subtotal),
    [subtotal]
  )

  // Keep attendeesByType in sync when quantities change
  useEffect(() => {
    setAttendeesByType((current) => {
      const updated: Record<string, AttendeeFormState[]> = {}

      for (const item of selectedItems) {
        const existing = current[item.ticketTypeId] ?? []
        const needed = item.quantity

        if (existing.length >= needed) {
          updated[item.ticketTypeId] = existing.slice(0, needed)
        } else {
          const added = Array.from({ length: needed - existing.length }, emptyAttendee)
          updated[item.ticketTypeId] = [...existing, ...added]
        }
      }

      return updated
    })
  }, [selectedItems])

  // Keep first attendee synced with buyer details
  useEffect(() => {
    if (selectedItems.length === 0) return

    const firstTypeId = selectedItems[0].ticketTypeId

    setAttendeesByType((current) => {
      const slots = current[firstTypeId]
      if (!slots || slots.length === 0) return current

      const first = slots[0]
      const nextFirst: AttendeeFormState = {
        ...first,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        title: buyer.title,
        organization: buyer.organization,
      }

      const unchanged =
        first.firstName === nextFirst.firstName &&
        first.lastName === nextFirst.lastName &&
        first.email === nextFirst.email &&
        first.title === nextFirst.title &&
        first.organization === nextFirst.organization

      if (unchanged) return current

      return {
        ...current,
        [firstTypeId]: [nextFirst, ...slots.slice(1)],
      }
    })
  }, [selectedItems, buyer.firstName, buyer.lastName, buyer.email, buyer.title, buyer.organization])

  function handleQuantityChange(ticketTypeId: string, quantity: number) {
    setQuantities((current) => ({
      ...current,
      [ticketTypeId]: Math.max(0, quantity),
    }))
  }

  function updateBuyerField<K extends keyof BuyerFormState>(field: K, value: BuyerFormState[K]) {
    setBuyer((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateAttendeeField(
    ticketTypeId: string,
    index: number,
    field: keyof AttendeeFormState,
    value: string
  ) {
    setAttendeesByType((current) => {
      const slots = current[ticketTypeId] ? [...current[ticketTypeId]] : []
      if (!slots[index]) return current
      slots[index] = { ...slots[index], [field]: value }
      return { ...current, [ticketTypeId]: slots }
    })
  }

  function fillAttendeeFromBuyer(ticketTypeId: string, index: number) {
    setAttendeesByType((current) => {
      const slots = current[ticketTypeId] ? [...current[ticketTypeId]] : []
      if (!slots[index]) return current
      slots[index] = {
        ...slots[index],
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        title: buyer.title,
        organization: buyer.organization,
      }
      return { ...current, [ticketTypeId]: slots }
    })
  }

  async function handleSubmit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault()

    if (selectedItems.length === 0) {
      setSubmitError('Select at least one ticket')
      return
    }

    const buyerEmailValue = buyer.email.trim()
    const firstSelectedTicketTypeId = selectedItems[0]?.ticketTypeId

    if (!buyer.firstName || !buyer.lastName) {
      setSubmitError('First name and last name are required')
      return
    }

    if (!buyerEmailValue) {
      setSubmitError('Email address is required')
      return
    }

    // Validate all attendee slots are filled
    for (const item of selectedItems) {
      const slots = attendeesByType[item.ticketTypeId] ?? []
      for (let i = 0; i < item.quantity; i++) {
        const linkedToBuyer = item.ticketTypeId === firstSelectedTicketTypeId && i === 0
        const a = linkedToBuyer
          ? {
              ...(slots[i] ?? emptyAttendee()),
              firstName: buyer.firstName,
              lastName: buyer.lastName,
              email: buyerEmailValue,
              title: buyer.title,
              organization: buyer.organization,
            }
          : slots[i]

        if (!a || !a.firstName || !a.lastName || !a.email) {
          const ticketName = ticketTypes.find((t) => t.id === item.ticketTypeId)?.name ?? 'ticket'
          setSubmitError(`Please fill in all attendee details for "${ticketName}" (ticket ${i + 1})`)
          return
        }
      }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          items: selectedItems.map((item) => ({
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
            attendees: (attendeesByType[item.ticketTypeId] ?? [])
              .slice(0, item.quantity)
              .map((attendee, index) => {
                const linkedToBuyer = item.ticketTypeId === firstSelectedTicketTypeId && index === 0
                if (!linkedToBuyer) return attendee

                return {
                  ...(attendee ?? emptyAttendee()),
                  firstName: buyer.firstName,
                  lastName: buyer.lastName,
                  email: buyerEmailValue,
                  title: buyer.title,
                  organization: buyer.organization,
                }
              }),
          })),
          buyer: {
            ...buyer,
            email: buyerEmailValue,
          },
          // Send both - backend will determine best discount
          discountCode: discount?.code,
          groupDiscountId: groupDiscount.id || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSubmitError(data.error || 'Failed to create order')
        return
      }

      // Redirect to the order detail page
      router.push(`/dashboard/events/${event.id}/orders/${data.order.id}`)
    } catch (error) {
      console.error('Failed to create manual order:', error)
      setSubmitError('Failed to create order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="grid gap-6 lg:grid-cols-3" onSubmit={handleSubmit}>
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">All prices include VAT (25%).</p>
            <TicketSelector
              ticketTypes={ticketTypes}
              quantities={quantities}
              onQuantityChange={handleQuantityChange}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buyer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="buyer-first-name" required>
                First Name
              </Label>
              <Input
                id="buyer-first-name"
                value={buyer.firstName}
                onChange={(e) => updateBuyerField('firstName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-last-name" required>
                Last Name
              </Label>
              <Input
                id="buyer-last-name"
                value={buyer.lastName}
                onChange={(e) => updateBuyerField('lastName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="buyer-email" required>
                Email
              </Label>
              <Input
                id="buyer-email"
                type="email"
                value={buyer.email}
                onChange={(e) => updateBuyerField('email', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-title">Title</Label>
              <Input
                id="buyer-title"
                value={buyer.title}
                onChange={(e) => updateBuyerField('title', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-organization">Organization</Label>
              <Input
                id="buyer-organization"
                value={buyer.organization}
                onChange={(e) => updateBuyerField('organization', e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="buyer-address">Address</Label>
              <Input
                id="buyer-address"
                value={buyer.address}
                onChange={(e) => updateBuyerField('address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-city">City</Label>
              <Input
                id="buyer-city"
                value={buyer.city}
                onChange={(e) => updateBuyerField('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-postal-code">Postal Code</Label>
              <Input
                id="buyer-postal-code"
                value={buyer.postalCode}
                onChange={(e) => updateBuyerField('postalCode', e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="buyer-country">Country</Label>
              <Input
                id="buyer-country"
                value={buyer.country}
                onChange={(e) => updateBuyerField('country', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Per-ticket attendee information */}
        {selectedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendee Information</CardTitle>
              <p className="text-sm text-gray-500">
                Please provide details for each ticket holder. The first ticket is pre-filled with buyer information.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedItems.map((item) => {
                const ticketType = ticketTypes.find((t) => t.id === item.ticketTypeId)
                const slots = attendeesByType[item.ticketTypeId] ?? []

                return (
                  <div key={item.ticketTypeId} className="space-y-4">
                    {Array.from({ length: item.quantity }, (_, i) => {
                      const attendee = slots[i] ?? emptyAttendee()
                      const isBuyerLinkedAttendee = item.ticketTypeId === selectedItems[0]?.ticketTypeId && i === 0
                      const attendeeDisplay = isBuyerLinkedAttendee
                        ? {
                            ...attendee,
                            firstName: buyer.firstName,
                            lastName: buyer.lastName,
                            email: buyer.email,
                            title: buyer.title,
                            organization: buyer.organization,
                          }
                        : attendee
                      const label =
                        item.quantity > 1
                          ? `${ticketType?.name ?? 'Ticket'} #${i + 1}`
                          : (ticketType?.name ?? 'Ticket')

                      return (
                        <div
                          key={`${item.ticketTypeId}-${i}`}
                          className="rounded-lg border border-gray-200 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-700">{label}</p>
                            {!isBuyerLinkedAttendee && buyer.firstName && buyer.lastName && buyer.email && (
                              <button
                                type="button"
                                onClick={() => fillAttendeeFromBuyer(item.ticketTypeId, i)}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                              >
                                Fill from buyer details
                              </button>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label
                                htmlFor={`attendee-${item.ticketTypeId}-${i}-first-name`}
                                required
                              >
                                First Name
                              </Label>
                              <Input
                                id={`attendee-${item.ticketTypeId}-${i}-first-name`}
                                value={attendeeDisplay.firstName}
                                onChange={(e) =>
                                  isBuyerLinkedAttendee
                                    ? updateBuyerField('firstName', e.target.value)
                                    : updateAttendeeField(item.ticketTypeId, i, 'firstName', e.target.value)
                                }
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`attendee-${item.ticketTypeId}-${i}-last-name`}
                                required
                              >
                                Last Name
                              </Label>
                              <Input
                                id={`attendee-${item.ticketTypeId}-${i}-last-name`}
                                value={attendeeDisplay.lastName}
                                onChange={(e) =>
                                  isBuyerLinkedAttendee
                                    ? updateBuyerField('lastName', e.target.value)
                                    : updateAttendeeField(item.ticketTypeId, i, 'lastName', e.target.value)
                                }
                                required
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label
                                htmlFor={`attendee-${item.ticketTypeId}-${i}-email`}
                                required
                              >
                                Email
                              </Label>
                              <Input
                                id={`attendee-${item.ticketTypeId}-${i}-email`}
                                type="email"
                                value={attendeeDisplay.email}
                                onChange={(e) =>
                                  isBuyerLinkedAttendee
                                    ? updateBuyerField('email', e.target.value)
                                    : updateAttendeeField(item.ticketTypeId, i, 'email', e.target.value)
                                }
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`attendee-${item.ticketTypeId}-${i}-title`}>
                                Title
                              </Label>
                              <Input
                                id={`attendee-${item.ticketTypeId}-${i}-title`}
                                value={attendeeDisplay.title}
                                onChange={(e) =>
                                  isBuyerLinkedAttendee
                                    ? updateBuyerField('title', e.target.value)
                                    : updateAttendeeField(item.ticketTypeId, i, 'title', e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`attendee-${item.ticketTypeId}-${i}-organization`}>
                                Organization
                              </Label>
                              <Input
                                id={`attendee-${item.ticketTypeId}-${i}-organization`}
                                value={attendeeDisplay.organization}
                                onChange={(e) =>
                                  isBuyerLinkedAttendee
                                    ? updateBuyerField('organization', e.target.value)
                                    : updateAttendeeField(item.ticketTypeId, i, 'organization', e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6 lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Promotions</CardTitle>
          </CardHeader>
          <CardContent>
            <DiscountCodeInput
              eventId={event.id}
              selectedTicketTypeIds={selectedTicketTypeIds}
              ticketQuantities={quantities}
              onDiscountChange={setDiscount}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedItems.length === 0 ? (
              <p className="text-sm text-gray-500">No tickets selected</p>
            ) : (
              <>
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div key={item.ticketTypeId} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {item.name} x {item.quantity}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.totalPrice, item.currency)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">
                      {formatCurrency(subtotal, selectedItems[0]?.currency ?? 'SEK')}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>
                        Discount
                        {appliedDiscountType === 'promo' && discount?.code && ` (${discount.code})`}
                        {appliedDiscountType === 'group' && ' (Group)'}
                      </span>
                      <span>-{formatCurrency(discountAmount, selectedItems[0]?.currency ?? 'SEK')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>incl. VAT (25%)</span>
                    <span>{formatCurrency(includedVat, selectedItems[0]?.currency ?? 'SEK')}</span>
                  </div>
                </div>

                {appliedDiscountType === 'group' && groupDiscount.description && (
                  <p className="text-xs text-green-600">{groupDiscount.description}</p>
                )}

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">
                      {formatCurrency(totalAmount, selectedItems[0]?.currency ?? 'SEK')}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">
              This will create an invoice order with status <strong>PENDING_INVOICE</strong>.
              The buyer will need to pay via invoice, and you can mark it as paid once payment is received.
            </p>
          </CardContent>
        </Card>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <Button
          type="submit"
          className="w-full"
          isLoading={isSubmitting}
          disabled={isSubmitting || selectedItems.length === 0}
        >
          Create Invoice Order
        </Button>
      </div>
    </form>
  )
}
