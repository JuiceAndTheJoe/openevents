'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DiscountCodeInput, type AppliedDiscount } from '@/components/tickets/DiscountCodeInput'
import { OrderSummary, type SummaryLineItem } from '@/components/tickets/OrderSummary'
import { TicketSelector, type SelectableTicketType } from '@/components/tickets/TicketSelector'
import { getClientOrderReservationTtlMinutes } from '@/lib/orders/reservation'
import { getIncludedVatFromVatInclusiveTotal, getPriceIncludingVat } from '@/lib/pricing/vat'
import { getVatRateForCountryNameOrCode } from '@/lib/pricing/vatRates'
import { COUNTRIES } from '@/lib/pricing/countries'
import { CountryCombobox } from '@/components/ui/country-combobox'

interface GroupDiscount {
  id: string
  ticketTypeId: string | null
  minQuantity: number
  discountType: string
  discountValue: number
}

interface CheckoutFormProps {
  event: {
    id: string
    slug: string
    title: string
    country: string | null
  }
  groupDiscounts?: GroupDiscount[]
}

// Checkout state persistence for payment-cancel recovery
interface PersistedCheckoutState {
  eventId: string
  quantities: Record<string, number>
  buyer: BuyerFormState
  attendeesByType: Record<string, AttendeeFormState[]>
  discountCode: string | null
  paymentMethod: 'PAYPAL' | 'INVOICE'
  savedAt: number
}

const CHECKOUT_STATE_KEY = 'openevents_checkout_state'
const CHECKOUT_STATE_TTL_MS = 30 * 60 * 1000 // 30 minutes

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

  // Calculate total quantity across all ticket types
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
          : `$${topGlobalDiscount.discountValue}`
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
            : `$${topTicketDiscount.discountValue}`
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

function saveCheckoutState(state: PersistedCheckoutState): void {
  try {
    localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save checkout state:', error)
  }
}

function loadCheckoutState(eventId: string): PersistedCheckoutState | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_STATE_KEY)
    if (!raw) return null

    const state = JSON.parse(raw) as PersistedCheckoutState

    // Check if state is for this event and not expired
    if (state.eventId !== eventId) return null
    if (Date.now() - state.savedAt > CHECKOUT_STATE_TTL_MS) {
      localStorage.removeItem(CHECKOUT_STATE_KEY)
      return null
    }

    return state
  } catch (error) {
    console.error('Failed to load checkout state:', error)
    return null
  }
}

function clearCheckoutState(): void {
  try {
    localStorage.removeItem(CHECKOUT_STATE_KEY)
  } catch (error) {
    console.error('Failed to clear checkout state:', error)
  }
}

export function CheckoutForm({ event, groupDiscounts = [] }: CheckoutFormProps) {
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
  const [countryError, setCountryError] = useState<string | null>(null)
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
  const wasSessionExpired = searchParams.get('session_expired') === 'true'

  const isAuthenticated = status === 'authenticated'

  // Track if we've restored state from localStorage (to show appropriate message)
  const [restoredFromSaved, setRestoredFromSaved] = useState(false)
  // Track the discount code to restore (separate from applied discount)
  const [pendingDiscountCode, setPendingDiscountCode] = useState<string | null>(null)

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

  // Pre-fill buyer email from session if logged in
  useEffect(() => {
    if (isAuthenticated && session?.user?.email) {
      setBuyer((current) => {
        // Only set email if it's empty (don't override user edits)
        if (!current.email) {
          return { ...current, email: session.user.email || '' }
        }
        return current
      })
    }
  }, [isAuthenticated, session?.user?.email])

  // Restore checkout state from localStorage when returning from a cancelled payment
  useEffect(() => {
    // Only restore if coming back from cancellation and ticket types are loaded
    if (!wasCancelled || ticketLoading || ticketTypes.length === 0) return

    const savedState = loadCheckoutState(event.id)
    if (!savedState) return

    // Restore quantities
    setQuantities(savedState.quantities)

    // Restore buyer info (but keep the current email from session)
    setBuyer((current) => ({
      ...savedState.buyer,
      email: current.email || savedState.buyer.email,
    }))

    // Restore attendees
    setAttendeesByType(savedState.attendeesByType)

    // Restore payment method
    setPaymentMethod(savedState.paymentMethod)

    // Set pending discount code for the DiscountCodeInput to apply
    if (savedState.discountCode) {
      setPendingDiscountCode(savedState.discountCode)
    }

    setRestoredFromSaved(true)

    // Clear saved state after restoring
    clearCheckoutState()
  }, [wasCancelled, ticketLoading, ticketTypes.length, event.id])

  const vatRate = useMemo(
    () => getVatRateForCountryNameOrCode(event.country ?? ''),
    [event.country]
  )

  const displayTicketTypes = useMemo(
    () => ticketTypes.map((tt) => ({ ...tt, price: getPriceIncludingVat(tt.price, vatRate) })),
    [ticketTypes, vatRate]
  )

  const selectedItems = useMemo<SummaryLineItem[]>(() => {
    return displayTicketTypes
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
  }, [quantities, displayTicketTypes])

  const subtotal = useMemo(
    () => Number(selectedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)),
    [selectedItems]
  )

  const groupDiscount = useMemo(
    () => calculateBestGroupDiscount(selectedItems, groupDiscounts),
    [selectedItems, groupDiscounts]
  )

  const promoCodeDiscountAmount = useMemo(
    () => calculateDiscountAmount(subtotal, discount, selectedItems),
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
    () => getIncludedVatFromVatInclusiveTotal(subtotal, vatRate),
    [subtotal, vatRate]
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

  // Keep first attendee in the first selected ticket type synced 1:1 with buyer details.
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
        [firstTypeId]: [
          nextFirst,
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

  function validateCountry(value: string): string | null {
    if (!value.trim()) return null
    const isValid = COUNTRIES.some((c) => c.name.toLowerCase() === value.trim().toLowerCase())
    return isValid ? null : 'Please write a valid country.'
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

    if (reservationExpiredInSession || reservationSecondsRemaining === 0) {
      setSubmitError('Your reservation expired. Refresh the page to start checkout again.')
      return
    }

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

    const countryValidationError = validateCountry(buyer.country)
    if (countryValidationError) {
      setCountryError(countryValidationError)
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
          const ticketName = displayTicketTypes.find((t) => t.id === item.ticketTypeId)?.name ?? 'ticket'
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

        // Check if redirect payment is needed
        if (payData.checkout?.type === 'redirect' && payData.checkout?.approvalUrl) {
          // Save checkout state before redirecting to Stripe
          // This allows recovery if user cancels or session expires
          saveCheckoutState({
            eventId: event.id,
            quantities,
            buyer,
            attendeesByType,
            discountCode: discount?.code ?? null,
            paymentMethod,
            savedAt: Date.now(),
          })

          setIsRedirecting(true)
          window.location.href = payData.checkout.approvalUrl
          return
        }

        // Payment completed (stub mode or already captured)
        if (payData.checkout?.type === 'completed') {
          clearCheckoutState()
          router.push(`/orders/${payData.order.orderNumber}`)
          return
        }

        // Invoice flow
        if (payData.checkout?.type === 'invoice') {
          clearCheckoutState()
          router.push(`/orders/${payData.order.orderNumber}`)
          return
        }
      }

      // Free order or invoice - go directly to confirmation
      clearCheckoutState()
      router.push(`/orders/${orderNumber}`)
    } catch (error) {
      console.error('Failed to complete checkout', error)
      setSubmitError('Checkout failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show loading state while loading tickets
  if (ticketLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading tickets...</div>
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
              <p className="text-sm text-gray-500">
                All prices include VAT ({Math.round(vatRate * 100)}%).
              </p>
            )}
            {!ticketLoading && !ticketError && (
              <TicketSelector
                ticketTypes={displayTicketTypes}
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
              <CountryCombobox
                id="buyer-country"
                value={buyer.country}
                placeholder="Search country…"
                error={countryError ?? undefined}
                onChange={(v) => {
                  updateBuyerField('country', v)
                  if (countryError) setCountryError(validateCountry(v))
                }}
                onBlur={() => setCountryError(validateCountry(buyer.country))}
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
                const ticketType = displayTicketTypes.find((t) => t.id === item.ticketTypeId)
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
                                Fill from my details
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
              initialCode={pendingDiscountCode}
            />
          </CardContent>
        </Card>

        <OrderSummary
          items={selectedItems}
          subtotal={subtotal}
          discountAmount={discountAmount}
          totalAmount={totalAmount}
          includedVat={includedVat}
          vatRate={vatRate}
          currency={selectedItems[0]?.currency ?? 'SEK'}
          discountCode={discount?.code}
          groupDiscountMessage={appliedDiscountType === 'group' ? groupDiscount.description : null}
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
            <CardContent className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="payment-method"
                  value="PAYPAL"
                  checked={paymentMethod === 'PAYPAL'}
                  onChange={() => setPaymentMethod('PAYPAL')}
                  disabled={discount?.discountType === 'INVOICE'}
                />
                Stripe
              </label>
              {/* Only show invoice option when an invoice-enabling discount code is applied */}
              {discount?.discountType === 'INVOICE' && (
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
              )}
              {discount?.discountType === 'INVOICE' && (
                <p className="text-xs text-gray-500">Invoice code applied. Checkout will create a pending invoice order.</p>
              )}
              {discount?.discountType === 'FREE_TICKET' && (
                <p className="text-xs text-green-600">Free ticket code applied. No payment required.</p>
              )}
              {/* Informational text about invoice payment */}
              {discount?.discountType !== 'INVOICE' && (
                <p className="mt-2 text-xs text-gray-500">
                  Want to pay by invoice? Contact{' '}
                  <a href="mailto:info@eyevinn.se" className="text-blue-600 hover:underline">
                    info@eyevinn.se
                  </a>{' '}
                  to request invoice payment.
                </p>
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
            <p className="text-sm font-medium text-yellow-800 mb-1">
              Payment was cancelled
            </p>
            <p className="text-sm text-yellow-700">
              {restoredFromSaved
                ? 'Your cart and attendee details have been restored. You can continue checkout when ready.'
                : 'You can try again when ready.'}
            </p>
            {wasSessionExpired && (
              <p className="text-sm text-yellow-700 mt-1">
                Note: Your session had expired, but you are now logged in again.
              </p>
            )}
          </div>
        )}

        {wasExpired && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800 mb-1">
              Reservation expired
            </p>
            <p className="text-sm text-red-700">
              Your previous ticket reservation has expired. Your cart has been cleared. Please select your tickets again to start a new reservation.
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
            ? 'Redirecting to Stripe...'
            : reservationExpiredInSession || reservationSecondsRemaining === 0
              ? 'Refresh Page to Continue'
            : totalAmount === 0
              ? 'Complete Free Order'
              : paymentMethod === 'PAYPAL'
                ? 'Pay with Stripe'
                : 'Place Order'}
        </Button>
      </div>
    </form>
  )
}
