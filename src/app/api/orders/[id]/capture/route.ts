import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { Prisma, PaymentMethod } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { canAccessOrder } from '@/lib/orders/authorization'
import { capturePayment, getPaymentStatus } from '@/lib/payments'
import { generateTicketCreateInput, lockTicketTypes } from '@/lib/orders'
import { expirePendingOrderIfNeeded } from '@/lib/orders/expirePendingOrder'
import { formatDateTime } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Handle PayPal return after user approval
 * PayPal redirects here with ?token=PAYPAL_ORDER_ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: orderId } = await context.params
    const { searchParams } = new URL(request.url)
    const paypalToken = searchParams.get('token')

    if (!paypalToken) {
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=invalid_token`)
    }

    // Find the order first (before auth check) so we can redirect properly on session expiry
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            startDate: true,
            locationType: true,
            venue: true,
            city: true,
            country: true,
            onlineUrl: true,
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
        items: {
          include: {
            ticketType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=order_not_found`)
    }

    // Check authentication - allow both authenticated and anonymous orders
    const user = await getCurrentUser()

    // For anonymous orders (userId is null), verify the PayPal token matches
    const isAnonymousOrder = order.userId === null
    const isValidAnonymousAccess = isAnonymousOrder && order.paymentId === paypalToken

    if (!user && !isValidAnonymousAccess) {
      // Session expired for authenticated order - redirect to a helpful status page
      // Include the PayPal token so we can check payment status
      const statusUrl = new URL(`${APP_URL}/checkout-status/${order.orderNumber}`)
      statusUrl.searchParams.set('session_expired', 'true')
      statusUrl.searchParams.set('token', paypalToken)
      return NextResponse.redirect(statusUrl.toString())
    }

    // For authenticated users or valid anonymous access, check permissions
    if (user) {
      const canManageOrder = canAccessOrder({
        orderUserId: order.userId,
        organizerUserId: order.event.organizer.userId,
        requesterUserId: user.id,
        requesterRoles: user.roles,
        isAnonymousOrderWithValidToken: false,
      })
      if (!canManageOrder) {
        console.error('[Capture] Forbidden order capture attempt:', {
          orderId: order.id,
          orderUserId: order.userId,
          organizerUserId: order.event.organizer.userId,
          requesterUserId: user.id,
        })
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (!isValidAnonymousAccess) {
      // This should not happen due to the check above, but just in case
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the PayPal token matches
    if (order.paymentId !== paypalToken) {
      console.error('[Capture] Token mismatch:', { expected: order.paymentId, received: paypalToken })
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=invalid_token`)
    }

    // Check if already paid
    if (order.status === 'PAID') {
      return NextResponse.redirect(`${APP_URL}/orders/${order.orderNumber}`)
    }

    if (order.status === 'PENDING' && order.expiresAt && order.expiresAt <= new Date()) {
      await expirePendingOrderIfNeeded(order.id)
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=reservation_expired`)
    }

    // Check if order can be paid
    if (order.status !== 'PENDING' && order.status !== 'PENDING_INVOICE') {
      return NextResponse.redirect(
        `${APP_URL}/checkout-error?error=invalid_status&status=${order.status}`
      )
    }

    const paypalOrderId = paypalToken || order.paymentId

    if (!paypalOrderId) {
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=no_payment_id`)
    }

    // Verify the order is approved
    const paymentStatus = await getPaymentStatus(paypalOrderId)

    if (!paymentStatus.isApproved) {
      console.error('[Capture] Order not approved:', paymentStatus)
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=not_approved`)
    }

    // Capture the payment
    const captureResult = await capturePayment(paypalOrderId)

    if (captureResult.status !== 'completed') {
      console.error('[Capture] Payment capture failed:', captureResult)
      return NextResponse.redirect(`${APP_URL}/checkout-error?error=capture_failed`)
    }

    // Complete the order in database
    const ticketTypeIds = Array.from(new Set(order.items.map((item) => item.ticketTypeId)))

    const paidOrder = await prisma.$transaction(
      async (tx) => {
        await lockTicketTypes(tx, ticketTypeIds)

        const latestOrder = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            items: {
              include: {
                ticketType: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            event: {
              select: {
                title: true,
                startDate: true,
                locationType: true,
                venue: true,
                city: true,
                country: true,
                onlineUrl: true,
              },
            },
          },
        })

        // Double-check status in case of race condition
        if (latestOrder.status === 'PAID') {
          return latestOrder
        }

        if (latestOrder.status !== 'PENDING' && latestOrder.status !== 'PENDING_INVOICE') {
          throw new Error(`Order cannot be paid in status ${latestOrder.status}`)
        }

        // Update ticket counts
        for (const item of latestOrder.items) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: {
              reservedCount: {
                decrement: item.quantity,
              },
              soldCount: {
                increment: item.quantity,
              },
            },
          })
        }

        // Mark order as paid
        await tx.order.update({
          where: { id: latestOrder.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            expiresAt: null,
            paymentId: captureResult.captureId,
            paymentMethod: PaymentMethod.PAYPAL,
          },
        })

        // Generate tickets
        const ticketCreateData = generateTicketCreateInput(
          latestOrder.id,
          latestOrder.items.map((item) => ({
            ticketTypeId: item.ticketTypeId,
            ticketTypeName: item.ticketType.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            currency: latestOrder.currency,
            attendees: Array.isArray(item.attendeeData) ? (item.attendeeData as unknown as import('@/lib/orders').AttendeeData[]) : undefined,
          }))
        )

        if (ticketCreateData.length > 0) {
          await tx.ticket.createMany({
            data: ticketCreateData,
          })
        }

        return tx.order.findUniqueOrThrow({
          where: { id: latestOrder.id },
          include: {
            items: {
              include: {
                ticketType: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            tickets: true,
            event: {
              select: {
                title: true,
                startDate: true,
                locationType: true,
                venue: true,
                city: true,
                country: true,
                onlineUrl: true,
              },
            },
          },
        })
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    // Send confirmation email
    await sendOrderConfirmationEmail(paidOrder.buyerEmail, {
      orderNumber: paidOrder.orderNumber,
      eventTitle: paidOrder.event.title,
      eventDate: formatDateTime(paidOrder.event.startDate),
      eventLocation:
        paidOrder.event.locationType === 'ONLINE'
          ? paidOrder.event.onlineUrl || 'Online event'
          : [paidOrder.event.venue, paidOrder.event.city, paidOrder.event.country]
              .filter(Boolean)
              .join(', '),
      tickets: paidOrder.items.map((item) => ({
        name: item.ticketType.name,
        quantity: item.quantity,
        price: `${item.totalPrice.toString()} ${paidOrder.currency}`,
      })),
      totalAmount: `${paidOrder.totalAmount.toString()} ${paidOrder.currency}`,
      buyerName: `${paidOrder.buyerFirstName} ${paidOrder.buyerLastName}`,
    })

    revalidateTag('event-analytics', 'max')
    revalidateTag('dashboard-analytics', 'max')

    // Redirect to confirmation page
    return NextResponse.redirect(`${APP_URL}/orders/${paidOrder.orderNumber}`)
  } catch (error) {
    console.error('[Capture] Failed to capture payment:', error)
    return NextResponse.redirect(`${APP_URL}/checkout-error?error=capture_exception`)
  }
}
