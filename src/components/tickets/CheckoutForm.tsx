'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DiscountCodeInput, type AppliedDiscount } from '@/components/tickets/DiscountCodeInput'
import { OrderSummary, type SummaryLineItem } from '@/components/tickets/OrderSummary'
import { TicketSelector, type SelectableTicketType } from '@/components/tickets/TicketSelector'

interface CheckoutFormProps {
  event: {
    id: string
    slug: string
    title: string
  }
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

function calculateDiscountAmount(
  subtotal: number,
  discount: AppliedDiscount | null,
  selectedItems: SummaryLineItem[]
): number {
  if (!discount) return 0

  const appliesToAll = discount.applicableTicketTypeIds.length === 0
  const discountableSubtotal = selectedItems
    .filter((item) => appliesToAll || discount.applicableTicketTypeIds.includes(item.ticketTypeId))
    .reduce((sum, item) => sum + item.totalPrice, 0)

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

export function CheckoutForm({ event }: CheckoutFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [ticketTypes, setTicketTypes] = useState<SelectableTicketType[]>([])
  const [ticketLoading, setTicketLoading] = useState(true)
  const [ticketError, setTicketError] = useState<string | null>(null)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Check if user returned from cancelled PayPal payment
  const wasCancelled = searchParams.get('cancelled') === 'true'

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

  const [paymentMethod, setPaymentMethod] = useState<'PAYPAL' | 'INVOICE'>('PAYPAL')

  useEffect(() => {
    async function fetchTicketTypes() {
      setTicketLoading(true)
      setTicketError(null)

      try {
        const response = await fetch(`/api/events/${event.id}/ticket-types`)
        const data = await response.json()

        if (!response.ok) {
          setTicketError(data.error || 'Failed to load ticket types')
          return
        }

        const parsedTicketTypes: SelectableTicketType[] = data.ticketTypes.map(
          (ticket: SelectableTicketType & { price: number | string }) => ({
            ...ticket,
            price: Number(ticket.price),
          })
        )

        setTicketTypes(parsedTicketTypes)
      } catch (error) {
        console.error('Failed to load ticket types', error)
        setTicketError('Could not load ticket types')
      } finally {
        setTicketLoading(false)
      }
    }

    fetchTicketTypes()
  }, [event.id])

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

  const discountAmount = useMemo(
    () => calculateDiscountAmount(subtotal, discount, selectedItems),
    [subtotal, discount, selectedItems]
  )

  const totalAmount = useMemo(
    () => Number(Math.max(0, subtotal - discountAmount).toFixed(2)),
    [subtotal, discountAmount]
  )

  const selectedTicketTypeIds = useMemo(
    () => selectedItems.map((item) => item.ticketTypeId),
    [selectedItems]
  )

  useEffect(() => {
    if (discount?.discountType === 'INVOICE') {
      setPaymentMethod('INVOICE')
    }
  }, [discount])

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

  async function handleSubmit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault()

    if (selectedItems.length === 0) {
      setSubmitError('Select at least one ticket')
      return
    }

    if (!buyer.firstName || !buyer.lastName || !buyer.email) {
      setSubmitError('First name, last name, and email are required')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const createOrderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          items: selectedItems.map((item) => ({
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
          })),
          buyer,
          discountCode: discount?.code,
        }),
      })

      const createOrderData = await createOrderResponse.json()

      if (!createOrderResponse.ok) {
        setSubmitError(createOrderData.error || 'Failed to create order')
        return
      }

      const orderNumber = createOrderData.order.orderNumber as string

      // Handle different checkout flows
      if (createOrderData.checkout.requiresPayment) {
        const payResponse = await fetch(`/api/orders/${createOrderData.order.id}/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentMethod }),
        })

        const payData = await payResponse.json()

        if (!payResponse.ok) {
          setSubmitError(payData.error || 'Payment failed')
          return
        }

        // Check if PayPal redirect is needed
        if (payData.checkout?.type === 'redirect' && payData.checkout?.approvalUrl) {
          setIsRedirecting(true)
          // Redirect to PayPal for payment approval
          window.location.href = payData.checkout.approvalUrl
          return
        }

        // Payment completed (stub mode or already captured)
        if (payData.checkout?.type === 'completed') {
          router.push(`/orders/${payData.order.orderNumber}/confirmation`)
          return
        }

        // Invoice flow
        if (payData.checkout?.type === 'invoice') {
          router.push(`/orders/${payData.order.orderNumber}/confirmation`)
          return
        }
      }

      // Free order or invoice - go directly to confirmation
      router.push(`/orders/${orderNumber}/confirmation`)
    } catch (error) {
      console.error('Failed to complete checkout', error)
      setSubmitError('Checkout failed. Please try again.')
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
            {ticketLoading && <p className="text-sm text-gray-500">Loading tickets...</p>}
            {ticketError && <p className="text-sm text-red-600">{ticketError}</p>}
            {!ticketLoading && !ticketError && (
              <TicketSelector
                ticketTypes={ticketTypes}
                quantities={quantities}
                onQuantityChange={handleQuantityChange}
              />
            )}
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
                onChange={(eventValue) => updateBuyerField('firstName', eventValue.target.value)}
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
                onChange={(eventValue) => updateBuyerField('lastName', eventValue.target.value)}
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
                onChange={(eventValue) => updateBuyerField('email', eventValue.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-title">Title</Label>
              <Input
                id="buyer-title"
                value={buyer.title}
                onChange={(eventValue) => updateBuyerField('title', eventValue.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-organization">Organization</Label>
              <Input
                id="buyer-organization"
                value={buyer.organization}
                onChange={(eventValue) => updateBuyerField('organization', eventValue.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="buyer-address">Address</Label>
              <Input
                id="buyer-address"
                value={buyer.address}
                onChange={(eventValue) => updateBuyerField('address', eventValue.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-city">City</Label>
              <Input
                id="buyer-city"
                value={buyer.city}
                onChange={(eventValue) => updateBuyerField('city', eventValue.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-postal-code">Postal Code</Label>
              <Input
                id="buyer-postal-code"
                value={buyer.postalCode}
                onChange={(eventValue) => updateBuyerField('postalCode', eventValue.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="buyer-country">Country</Label>
              <Input
                id="buyer-country"
                value={buyer.country}
                onChange={(eventValue) => updateBuyerField('country', eventValue.target.value)}
              />
            </div>
          </CardContent>
        </Card>
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
              onDiscountChange={setDiscount}
            />
          </CardContent>
        </Card>

        <OrderSummary
          items={selectedItems}
          subtotal={subtotal}
          discountAmount={discountAmount}
          totalAmount={totalAmount}
          currency={selectedItems[0]?.currency ?? 'SEK'}
          discountCode={discount?.code}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="payment-method"
                value="PAYPAL"
                checked={paymentMethod === 'PAYPAL'}
                onChange={() => setPaymentMethod('PAYPAL')}
                disabled={discount?.discountType === 'INVOICE'}
              />
              PayPal
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="payment-method"
                value="INVOICE"
                checked={paymentMethod === 'INVOICE'}
                onChange={() => setPaymentMethod('INVOICE')}
              />
              Invoice
            </label>
            {discount?.discountType === 'INVOICE' && (
              <p className="text-xs text-gray-500">Invoice code applied. Checkout will create a pending invoice order.</p>
            )}
          </CardContent>
        </Card>

        {wasCancelled && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              Payment was cancelled. You can try again when ready.
            </p>
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <Button
          type="submit"
          className="w-full"
          isLoading={isSubmitting || isRedirecting}
          disabled={isSubmitting || isRedirecting}
        >
          {isRedirecting
            ? 'Redirecting to PayPal...'
            : totalAmount === 0
              ? 'Complete Free Order'
              : paymentMethod === 'PAYPAL'
                ? 'Pay with PayPal'
                : 'Place Order'}
        </Button>
      </div>
    </form>
  )
}
