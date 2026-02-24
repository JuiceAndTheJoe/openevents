import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail, sendEventCancellationEmail } from '@/lib/email'
import { formatDateTime } from '@/lib/utils'

const ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX = 'account-delete-confirm:'
const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token) {
      return redirectTo('/login?error=missing_delete_token', request)
    }

    const now = new Date()
    const verificationToken = await prisma.userVerificationToken.findUnique({
      where: {
        token: `${ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX}${token}`,
      },
      select: {
        id: true,
        userId: true,
        expires: true,
        user: {
          select: {
            id: true,
            email: true,
            deletedAt: true,
            organizerProfile: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })

    if (!verificationToken) {
      return redirectTo('/login?error=invalid_delete_token', request)
    }

    if (verificationToken.expires <= now) {
      await prisma.userVerificationToken.delete({
        where: { id: verificationToken.id },
      })
      return redirectTo('/login?error=delete_token_expired', request)
    }

    if (!verificationToken.user || verificationToken.user.deletedAt) {
      await prisma.userVerificationToken.deleteMany({
        where: { id: verificationToken.id },
      })
      return redirectTo('/login?message=account_deleted', request)
    }

    const deletionEffectiveAt = new Date(
      now.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    )
    const anonymizedEmail = `deleted+${verificationToken.userId}-${now.getTime()}@openevents.invalid`

    const activeEvents = verificationToken.user.organizerProfile
      ? await prisma.event.findMany({
          where: {
            organizerId: verificationToken.user.organizerProfile.id,
            status: 'PUBLISHED',
            startDate: {
              gt: now,
            },
          },
          select: {
            id: true,
            title: true,
            startDate: true,
            orders: {
              where: {
                status: {
                  in: ['PAID', 'PENDING', 'PENDING_INVOICE'],
                },
              },
              select: {
                buyerEmail: true,
                buyerFirstName: true,
                buyerLastName: true,
                orderNumber: true,
              },
            },
          },
        })
      : []

    const activeEventIds = activeEvents.map((event) => event.id)
    const attendeeNotifications = activeEvents.flatMap((event) =>
      event.orders.map((order) => ({
        eventTitle: event.title,
        eventDate: event.startDate,
        order,
      }))
    )

    await prisma.$transaction(async (tx) => {
      if (activeEventIds.length > 0) {
        await tx.event.updateMany({
          where: {
            id: {
              in: activeEventIds,
            },
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
          },
        })

        await tx.order.updateMany({
          where: {
            eventId: {
              in: activeEventIds,
            },
            status: {
              in: ['PENDING', 'PENDING_INVOICE'],
            },
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            expiresAt: null,
          },
        })

        await tx.order.updateMany({
          where: {
            eventId: {
              in: activeEventIds,
            },
            status: 'PAID',
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            expiresAt: null,
            refundStatus: 'PENDING',
            refundReason: 'Organizer account deleted',
          },
        })
      }

      await tx.session.deleteMany({
        where: { userId: verificationToken.userId },
      })

      await tx.account.deleteMany({
        where: { userId: verificationToken.userId },
      })

      await tx.userVerificationToken.deleteMany({
        where: { userId: verificationToken.userId },
      })

      await tx.passwordResetToken.deleteMany({
        where: { userId: verificationToken.userId },
      })

      await tx.userRole.deleteMany({
        where: { userId: verificationToken.userId },
      })

      await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          email: anonymizedEmail,
          firstName: null,
          lastName: null,
          passwordHash: null,
          emailVerified: null,
          deletedAt: deletionEffectiveAt,
          anonymizedAt: now,
        },
      })
    })

    if (attendeeNotifications.length > 0) {
      await Promise.allSettled(
        attendeeNotifications.map(({ eventTitle, eventDate, order }) =>
          sendEventCancellationEmail(order.buyerEmail, {
            eventTitle,
            eventDate: formatDateTime(eventDate),
            buyerName: `${order.buyerFirstName} ${order.buyerLastName}`.trim() || 'Attendee',
            orderNumber: order.orderNumber,
          })
        )
      )
    }

    await sendEmail({
      to: verificationToken.user.email,
      subject: 'Your OpenEvents account deletion has been confirmed',
      html: `
        <p>Your account deletion request has been confirmed and completed.</p>
        <p>Your personal account data has been anonymized.</p>
        <p>The account record will remain in retention until <strong>${formatDateTime(deletionEffectiveAt)}</strong>.</p>
      `,
      text: `Your account deletion request has been confirmed and completed. Personal data has been anonymized. The account record will remain in retention until ${formatDateTime(deletionEffectiveAt)}.`,
    })

    return redirectTo('/login?message=account_deleted', request)
  } catch (error) {
    console.error('Failed to confirm account deletion:', error)
    return redirectTo('/login?error=account_delete_failed', request)
  }
}
