'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DiscountCodeInput, type AppliedDiscount } from '@/components/tickets/DiscountCodeInput'
import { OrderSummary, type SummaryLineItem } from '@/components/tickets/OrderSummary'
import { TicketSelector, type SelectableTicketType } from '@/components/tickets/TicketSelector'
import { getClientOrderReservationTtlMinutes } from '@/lib/orders/reservation'

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

function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function CheckoutForm({ event }: CheckoutFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const initialReservationTtlMinutes = getClientOrderReservationTtlMinutes()

  const [ticketTypes, setTicketTypes] = useState<SelectableTicketType[]>([])
  const [ticketLoading, setTicketLoading] = useState(true)
  const [ticketError, setTicketError] = useState<string | null>(null)

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [reservationTtlMinutes, setReservationTtlMinutes] = useState(initialReservationTtlMinutes)
  const [reservationExpiresAt, setReservationExpiresAt] = useState<Date | null>(() =>
    new Date(Date.now() + initialReservationTtlMinutes * 60 * 1000)
  )
  const [reservationSecondsRemaining, setReservationSecondsRemaining] = useState<number | null>(
    Math.max(0, initialReservationTtlMinutes * 60)
  )
  const [reservationExpiredInSession, setReservationExpiredInSession] = useState(false)

  // Map of ticketTypeId -> AttendeeFormState[]
  const [attendeesByType, setAttendeesByType] = useState<Record<string, AttendeeFormState[]>>({})

  const wasCancelled = searchParams.get('cancelled') === 'true'
  const wasExpired = searchParams.get('expired') === 'true'

  const isAuthenticated = status === 'authenticated'
  const isLoadingAuth = status === 'loading'

  const [buyer, setBuyer] = useState<BuyerFormState>({
    firstName: '',
    lastName: '',
    email: session?.user?.email ?? '',
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

  // Keep attendeesByType in sync when quantities change
  useEffect(() => {
    setAttendeesByType((current) => {
      const updated: Record<string, AttendeeFormState[]> = {}

      for (const item of selectedItems) {
        const existing = current[item.ticketTypeId] ?? []
        const needed = item.quantity

        if (existing.length >= needed) {
          // Trim extras
          updated[item.ticketTypeId] = existing.slice(0, needed)
        } else {
          // Add empty slots for new tickets
          const added = Array.from({ length: needed - existing.length }, emptyAttendee)
          updated[item.ticketTypeId] = [...existing, ...added]
        }
      }

      return updated
    })
  }, [selectedItems])

  // Pre-fill first attendee slot of the first ticket type with buyer info
  useEffect(() => {
    if (selectedItems.length === 0) return

    const firstTypeId = selectedItems[0].ticketTypeId

    setAttendeesByType((current) => {
      const slots = current[firstTypeId]
      if (!slots || slots.length === 0) return current

      // Only auto-update if the slot looks empty or still matches old buyer info
      const first = slots[0]
      const looksUnedited =
        first.firstName === '' ||
        first.firstName === buyer.firstName

      if (!looksUnedited) return current

      return {
        ...current,
        [firstTypeId]: [
          {
            ...first,
            firstName: buyer.firstName,
            lastName: buyer.lastName,
            email: buyer.email,
            title: buyer.title,
            organization: buyer.organization,
          },
          ...slots.slice(1),
        ],
      }
    })
  }, [selectedItems, buyer.firstName, buyer.lastName, buyer.email, buyer.title, buyer.organization])

  useEffect(() => {
    if (discount?.discountType === 'INVOICE') {
      setPaymentMethod('INVOICE')
    }
  }, [discount])

  useEffect(() => {
    const accountEmail = session?.user?.email?.trim()
    if (!accountEmail) return

    setBuyer((current) => (
      current.email === accountEmail
        ? current
        : { ...current, email: accountEmail }
    ))
  }, [session?.user?.email])

  // Fetch user profile to get firstName/lastName (not available in session)
  useEffect(() => {
    if (!isAuthenticated) return

    async function fetchUserProfile() {
      try {
        const response = await fetch('/api/users/me')
        if (!response.ok) return

        const data = await response.json()
        const { firstName, lastName } = data.data || {}

        setBuyer((current) => {
          // Only update if fields are still empty (user hasn't typed anything)
          const shouldUpdateFirst = !current.firstName && firstName
          const shouldUpdateLast = !current.lastName && lastName

          if (!shouldUpdateFirst && !shouldUpdateLast) return current

          return {
            ...current,
            firstName: shouldUpdateFirst ? firstName : current.firstName,
            lastName: shouldUpdateLast ? lastName : current.lastName,
          }
        })
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
      }
    }

    fetchUserProfile()
  }, [isAuthenticated])

  useEffect(() => {
    if (!reservationExpiresAt) {
      if (reservationExpiredInSession) {
        setReservationSecondsRemaining(0)
      } else {
        setReservationSecondsRemaining(null)
      }
      return
    }

    const updateRemaining = () => {
      const remainingSeconds = Math.ceil((reservationExpiresAt.getTime() - Date.now()) / 1000)
      if (remainingSeconds <= 0) {
        setReservationSecondsRemaining(0)
        setReservationExpiresAt(null)
        setReservationExpiredInSession(true)
        setSubmitError('Your reservation expired. Refresh the page to start checkout again.')
        return true
      }

      setReservationSecondsRemaining(remainingSeconds)
      return false
    }

    if (updateRemaining()) {
      return
    }

    const interval = window.setInterval(updateRemaining, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [reservationExpiresAt, reservationExpiredInSession])

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

  async function handleSubmit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault()

    if (reservationExpiredInSession || reservationSecondsRemaining === 0) {
      setSubmitError('Your reservation expired. Refresh the page to start checkout again.')
      return
    }

    if (selectedItems.length === 0) {
      setSubmitError('Select at least one ticket')
      return
    }

    const accountEmail = session?.user?.email?.trim() || buyer.email.trim()

    if (!buyer.firstName || !buyer.lastName) {
      setSubmitError('First name and last name are required')
      return
    }

    if (!accountEmail) {
      setSubmitError('Your account does not have an email address. Please update your profile.')
      return
    }

    // Validate all attendee slots are filled
    for (const item of selectedItems) {
      const slots = attendeesByType[item.ticketTypeId] ?? []
      for (let i = 0; i < item.quantity; i++) {
        const a = slots[i]
        if (!a || !a.firstName || !a.lastName || !a.email) {
          const ticketName = ticketTypes.find((t) => t.id === item.ticketTypeId)?.name ?? 'ticket'
          setSubmitError(`Please fill in all attendee details for "${ticketName}" (ticket ${i + 1})`)
          return
        }
      }
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setReservationExpiresAt(null)
    setReservationSecondsRemaining(null)

    try {
      let createdOrderReservationExpiresAt: Date | null = null

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
            attendees: (attendeesByType[item.ticketTypeId] ?? []).slice(0, item.quantity),
          })),
          buyer: {
            ...buyer,
            email: accountEmail,
          },
          discountCode: discount?.code,
        }),
      })

      const createOrderData = await createOrderResponse.json()

      if (!createOrderResponse.ok) {
        setSubmitError(createOrderData.error || 'Failed to create order')
        return
      }

      const orderNumber = createOrderData.order.orderNumber as string
      const nextReservationTtl = createOrderData.checkout?.reservationTtlMinutes
      if (typeof nextReservationTtl === 'number' && nextReservationTtl > 0) {
        setReservationTtlMinutes(Math.floor(nextReservationTtl))
      }

      if (createOrderData.checkout?.requiresPayment) {
        const rawReservationExpiresAt = createOrderData.checkout?.reservationExpiresAt
        if (typeof rawReservationExpiresAt === 'string') {
          const parsedReservationExpiresAt = new Date(rawReservationExpiresAt)
          if (!Number.isNaN(parsedReservationExpiresAt.getTime())) {
            createdOrderReservationExpiresAt = parsedReservationExpiresAt
            setReservationExpiresAt(parsedReservationExpiresAt)
          }
        }
      }

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

        const reservationExpiredAfterPay =
          createdOrderReservationExpiresAt !== null &&
          createdOrderReservationExpiresAt.getTime() <= Date.now()

        if (reservationExpiredAfterPay) {
          setReservationExpiredInSession(true)
          setSubmitError('Your reservation expired. Refresh the page to start checkout again.')
          return
        }

        // Check if PayPal redirect is needed
        if (payData.checkout?.type === 'redirect' && payData.checkout?.approvalUrl) {
          setIsRedirecting(true)
          window.location.href = payData.checkout.approvalUrl
          return
        }

        // Payment completed (stub mode or already captured)
        if (payData.checkout?.type === 'completed') {
          router.push(`/orders/${payData.order.orderNumber}`)
          return
        }

        // Invoice flow
        if (payData.checkout?.type === 'invoice') {
          router.push(`/orders/${payData.order.orderNumber}`)
          return
        }
      }

      // Free order or invoice - go directly to confirmation
      router.push(`/orders/${orderNumber}`)
    } catch (error) {
      console.error('Failed to complete checkout', error)
      setSubmitError('Checkout failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated && !isLoadingAuth) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">
                Sign in to purchase tickets
              </h2>
              <p className="mb-6 text-gray-600">
                You need to log in or create an account to buy tickets for this event.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/login?callbackUrl=/events/${event.slug}/checkout`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Log in
                </Link>
                <Link
                  href={`/register?callbackUrl=/events/${event.slug}/checkout`}
                  className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Create an account
                </Link>
              </div>
              <p className="mt-4 text-xs text-gray-500">
                After signing in, you&apos;ll be redirected back to complete your purchase.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state while checking auth
  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
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
              <Label htmlFor="buyer-email">Account Email</Label>
              <p
                id="buyer-email"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                {session?.user?.email || 'No account email available'}
              </p>
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

        {/* Per-ticket attendee information */}
        {selectedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendee Information</CardTitle>
              <p className="text-sm text-gray-500">
                Please provide details for each ticket holder. The first ticket is pre-filled with your buyer information.
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
                      const label =
                        item.quantity > 1
                          ? `${ticketType?.name ?? 'Ticket'} #${i + 1}`
                          : (ticketType?.name ?? 'Ticket')

                      return (
                        <div
                          key={`${item.ticketTypeId}-${i}`}
                          className="rounded-lg border border-gray-200 p-4"
                        >
                          <p className="mb-3 text-sm font-medium text-gray-700">{label}</p>
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
                                value={attendee.firstName}
                                onChange={(e) =>
                                  updateAttendeeField(item.ticketTypeId, i, 'firstName', e.target.value)
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
                                value={attendee.lastName}
                                onChange={(e) =>
                                  updateAttendeeField(item.ticketTypeId, i, 'lastName', e.target.value)
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
                                value={attendee.email}
                                onChange={(e) =>
                                  updateAttendeeField(item.ticketTypeId, i, 'email', e.target.value)
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
                                value={attendee.title}
                                onChange={(e) =>
                                  updateAttendeeField(item.ticketTypeId, i, 'title', e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`attendee-${item.ticketTypeId}-${i}-organization`}>
                                Organization
                              </Label>
                              <Input
                                id={`attendee-${item.ticketTypeId}-${i}-organization`}
                                value={attendee.organization}
                                onChange={(e) =>
                                  updateAttendeeField(item.ticketTypeId, i, 'organization', e.target.value)
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
            <CardTitle className="text-lg">Reservation Window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              Pending checkout reservations are held for {reservationTtlMinutes} minutes.
            </p>
            {reservationSecondsRemaining !== null && reservationSecondsRemaining > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                Your current reservation expires in {formatRemainingTime(reservationSecondsRemaining)}.
              </p>
            )}
            {reservationSecondsRemaining === 0 && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                This reservation expired. Refresh the page to start checkout again.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Hide payment method selection for free orders */}
        {totalAmount > 0 && (
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
              {discount?.discountType === 'FREE_TICKET' && (
                <p className="text-xs text-green-600">Free ticket code applied. No payment required.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Show message for free orders */}
        {totalAmount === 0 && selectedItems.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-green-700">
                <span className="font-medium">No payment required.</span> Your order total is $0.
              </p>
            </CardContent>
          </Card>
        )}

        {wasCancelled && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              Payment was cancelled. You can try again when ready.
            </p>
          </div>
        )}

        {wasExpired && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              Your previous reservation expired. Refresh the page to start checkout again.
            </p>
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <Button
          type="submit"
          className="w-full"
          isLoading={isSubmitting || isRedirecting}
          disabled={isSubmitting || isRedirecting || reservationExpiredInSession || reservationSecondsRemaining === 0}
        >
          {isRedirecting
            ? 'Redirecting to PayPal...'
            : reservationExpiredInSession || reservationSecondsRemaining === 0
              ? 'Refresh Page to Continue'
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
