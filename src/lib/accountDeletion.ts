import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  sendAccountDeletionCancelledEmail,
  sendAccountDeletionConfirmationEmail,
  sendAccountDeletionScheduledEmail,
  sendEventCancellationEmail,
} from '@/lib/email'
import { lockTicketTypes } from '@/lib/orders'
import { getDiscountUsageUnitsFromItems, releaseDiscountCodeUsage } from '@/lib/orders/discountUsage'
import { formatDateTime, generateToken } from '@/lib/utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const DELETION_CONFIRMATION_TTL_HOURS = readPositiveInteger(
  process.env.ACCOUNT_DELETION_CONFIRMATION_TTL_HOURS,
  24
)
const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = readPositiveInteger(
  process.env.ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  30
)
const DEFAULT_CLEANUP_LIMIT = 50
const MAX_CLEANUP_LIMIT = 200
const ACCOUNT_DELETION_REFUND_REASON = 'Organizer account deleted'

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function normalizeCleanupLimit(limit?: number): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return DEFAULT_CLEANUP_LIMIT
  }

  return Math.min(Math.floor(limit), MAX_CLEANUP_LIMIT)
}

function buildDeletionConfirmUrl(token: string): string {
  return `${APP_URL}/api/users/account-deletion/confirm?token=${encodeURIComponent(token)}`
}

function buildDeletionCancelUrl(token: string): string {
  return `${APP_URL}/api/users/account-deletion/cancel?token=${encodeURIComponent(token)}`
}

function buildAnonymizedEmail(userId: string): string {
  return `deleted-${userId}-${Date.now()}@deleted.invalid`
}

function clearDeletionLifecycleFields() {
  return {
    deletionRequestedAt: null,
    deletionConfirmedAt: null,
    deletionScheduledFor: null,
    deletionConfirmationToken: null,
    deletionConfirmationExpiresAt: null,
    deletionCancellationToken: null,
  }
}

export type AccountDeletionRequestResult = {
  status: 'confirmation_sent' | 'already_scheduled'
  scheduledFor?: Date
  confirmationExpiresAt?: Date
}

export async function requestAccountDeletion(userId: string): Promise<AccountDeletionRequestResult> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      deletionScheduledFor: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.deletionScheduledFor && user.deletionScheduledFor > new Date()) {
    return {
      status: 'already_scheduled',
      scheduledFor: user.deletionScheduledFor,
    }
  }

  const now = new Date()
  const confirmationToken = generateToken()
  const confirmationExpiresAt = new Date(
    now.getTime() + DELETION_CONFIRMATION_TTL_HOURS * 60 * 60 * 1000
  )

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletionRequestedAt: now,
      deletionConfirmedAt: null,
      deletionScheduledFor: null,
      deletionConfirmationToken: confirmationToken,
      deletionConfirmationExpiresAt: confirmationExpiresAt,
      deletionCancellationToken: null,
    },
  })

  await sendAccountDeletionConfirmationEmail(user.email, {
    confirmUrl: buildDeletionConfirmUrl(confirmationToken),
    expiresAt: confirmationExpiresAt,
  })

  return {
    status: 'confirmation_sent',
    confirmationExpiresAt,
  }
}

export type ConfirmAccountDeletionResult =
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'scheduled'; scheduledFor: Date }

export async function confirmAccountDeletionByToken(
  token: string
): Promise<ConfirmAccountDeletionResult> {
  const user = await prisma.user.findFirst({
    where: {
      deletionConfirmationToken: token,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      deletionConfirmationExpiresAt: true,
      deletionScheduledFor: true,
    },
  })

  if (!user) {
    return { status: 'invalid' }
  }

  if (user.deletionScheduledFor && user.deletionScheduledFor > new Date()) {
    return {
      status: 'scheduled',
      scheduledFor: user.deletionScheduledFor,
    }
  }

  if (!user.deletionConfirmationExpiresAt || user.deletionConfirmationExpiresAt < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionConfirmationToken: null,
        deletionConfirmationExpiresAt: null,
      },
    })

    return { status: 'expired' }
  }

  const now = new Date()
  const scheduledFor = new Date(
    now.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  )
  const cancellationToken = generateToken()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletionConfirmedAt: now,
      deletionScheduledFor: scheduledFor,
      deletionConfirmationToken: null,
      deletionConfirmationExpiresAt: null,
      deletionCancellationToken: cancellationToken,
    },
  })

  await sendAccountDeletionScheduledEmail(user.email, {
    cancelUrl: buildDeletionCancelUrl(cancellationToken),
    scheduledFor,
    gracePeriodDays: ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  })

  return {
    status: 'scheduled',
    scheduledFor,
  }
}

export async function cancelAccountDeletionByToken(token: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      deletionCancellationToken: token,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
    },
  })

  if (!user) {
    return false
  }

  await prisma.user.update({
    where: { id: user.id },
    data: clearDeletionLifecycleFields(),
  })

  await sendAccountDeletionCancelledEmail(user.email)

  return true
}

export async function cancelAccountDeletionForUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      OR: [
        { deletionRequestedAt: { not: null } },
        { deletionScheduledFor: { not: null } },
      ],
    },
    select: {
      id: true,
      email: true,
    },
  })

  if (!user) {
    return false
  }

  await prisma.user.update({
    where: { id: user.id },
    data: clearDeletionLifecycleFields(),
  })

  await sendAccountDeletionCancelledEmail(user.email)

  return true
}

type EventCancellationNotification = {
  buyerEmail: string
  buyerFirstName: string
  buyerLastName: string
  orderNumber: string
  eventTitle: string
  eventStartDate: Date
}

function appendOrderRefundNote(existing: string | null): string {
  const note = `Account deletion on ${new Date().toISOString()}: manual refund may be required.`
  return existing ? `${existing}\n${note}` : note
}

export type FinalizeAccountDeletionResult = {
  finalized: boolean
  eventsCancelled: number
  attendeeNotificationsSent: number
  attendeeNotificationsFailed: number
}

export async function finalizeAccountDeletionForUser(
  userId: string
): Promise<FinalizeAccountDeletionResult> {
  const now = new Date()

  const cancellationData = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          deletionScheduledFor: {
            lte: now,
          },
        },
        select: {
          id: true,
          organizerProfile: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!user) {
        return null
      }

      let eventsCancelled = 0
      const notifications: EventCancellationNotification[] = []

      if (user.organizerProfile) {
        const activeEvents = await tx.event.findMany({
          where: {
            organizerId: user.organizerProfile.id,
            status: {
              in: ['DRAFT', 'PUBLISHED'],
            },
          },
          select: {
            id: true,
            title: true,
            startDate: true,
          },
        })

        for (const event of activeEvents) {
          const orders = await tx.order.findMany({
            where: {
              eventId: event.id,
              status: {
                in: ['PAID', 'PENDING_INVOICE', 'PENDING'],
              },
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              discountCodeId: true,
              buyerEmail: true,
              buyerFirstName: true,
              buyerLastName: true,
              refundNotes: true,
              items: {
                select: {
                  ticketTypeId: true,
                  quantity: true,
                },
              },
            },
          })

          const ticketTypeIds = Array.from(
            new Set(orders.flatMap((order) => order.items.map((item) => item.ticketTypeId)))
          )
          await lockTicketTypes(tx, ticketTypeIds)

          const reservedReleases = new Map<string, number>()
          const soldReleases = new Map<string, number>()
          const pendingOrderIds: string[] = []
          const paidOrderIds: string[] = []

          for (const order of orders) {
            if (order.status === 'PAID') {
              paidOrderIds.push(order.id)
            } else {
              pendingOrderIds.push(order.id)
            }

            for (const item of order.items) {
              const target = order.status === 'PAID' ? soldReleases : reservedReleases
              target.set(item.ticketTypeId, (target.get(item.ticketTypeId) || 0) + item.quantity)
            }

            notifications.push({
              buyerEmail: order.buyerEmail,
              buyerFirstName: order.buyerFirstName,
              buyerLastName: order.buyerLastName,
              orderNumber: order.orderNumber,
              eventTitle: event.title,
              eventStartDate: event.startDate,
            })
          }

          for (const [ticketTypeId, quantity] of reservedReleases.entries()) {
            await tx.ticketType.update({
              where: { id: ticketTypeId },
              data: {
                reservedCount: {
                  decrement: quantity,
                },
              },
            })
          }

          for (const [ticketTypeId, quantity] of soldReleases.entries()) {
            await tx.ticketType.update({
              where: { id: ticketTypeId },
              data: {
                soldCount: {
                  decrement: quantity,
                },
              },
            })
          }

          if (paidOrderIds.length > 0) {
            await tx.ticket.updateMany({
              where: {
                orderId: { in: paidOrderIds },
                status: 'ACTIVE',
              },
              data: {
                status: 'CANCELLED',
              },
            })

            await tx.order.updateMany({
              where: {
                id: {
                  in: paidOrderIds,
                },
              },
              data: {
                status: 'CANCELLED',
                cancelledAt: now,
                expiresAt: null,
                refundStatus: 'PENDING',
                refundReason: ACCOUNT_DELETION_REFUND_REASON,
              },
            })

            for (const paidOrder of orders.filter((order) => order.status === 'PAID')) {
              await tx.order.update({
                where: { id: paidOrder.id },
                data: {
                  refundNotes: appendOrderRefundNote(paidOrder.refundNotes),
                },
              })
            }
          }

          if (pendingOrderIds.length > 0) {
            await tx.order.updateMany({
              where: {
                id: {
                  in: pendingOrderIds,
                },
              },
              data: {
                status: 'CANCELLED',
                cancelledAt: now,
                expiresAt: null,
              },
            })
          }

          for (const order of orders) {
            if (!order.discountCodeId) continue
            const usageUnits = getDiscountUsageUnitsFromItems(order.items)
            await releaseDiscountCodeUsage(tx, order.discountCodeId, usageUnits)
          }

          await tx.event.update({
            where: { id: event.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
            },
          })

          eventsCancelled += 1
        }
      }

      return {
        eventsCancelled,
        notifications,
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )

  if (!cancellationData) {
    return {
      finalized: false,
      eventsCancelled: 0,
      attendeeNotificationsSent: 0,
      attendeeNotificationsFailed: 0,
    }
  }

  const emailResults = await Promise.allSettled(
    cancellationData.notifications.map((notification) =>
      sendEventCancellationEmail(notification.buyerEmail, {
        eventTitle: notification.eventTitle,
        eventDate: formatDateTime(notification.eventStartDate),
        buyerName:
          `${notification.buyerFirstName} ${notification.buyerLastName}`.trim() || 'Attendee',
        orderNumber: notification.orderNumber,
      })
    )
  )

  const attendeeNotificationsFailed = emailResults.filter(
    (result) => result.status === 'rejected'
  ).length
  const attendeeNotificationsSent = emailResults.length - attendeeNotificationsFailed

  const finalized = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          deletionScheduledFor: {
            lte: now,
          },
        },
        select: {
          id: true,
          organizerProfile: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!user) {
        return false
      }

      await tx.account.deleteMany({ where: { userId } })
      await tx.session.deleteMany({ where: { userId } })
      await tx.userRole.deleteMany({ where: { userId } })
      await tx.userVerificationToken.deleteMany({ where: { userId } })
      await tx.passwordResetToken.deleteMany({ where: { userId } })

      if (user.organizerProfile) {
        await tx.organizerProfile.update({
          where: { id: user.organizerProfile.id },
          data: {
            orgName: 'Deleted Organizer',
            description: null,
            logo: null,
            website: null,
            socialLinks: Prisma.DbNull,
          },
        })
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: buildAnonymizedEmail(user.id),
          firstName: 'Deleted',
          lastName: 'User',
          image: null,
          passwordHash: null,
          emailVerified: null,
          deletedAt: now,
          anonymizedAt: now,
          ...clearDeletionLifecycleFields(),
        },
      })

      return true
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  )

  return {
    finalized,
    eventsCancelled: cancellationData.eventsCancelled,
    attendeeNotificationsSent,
    attendeeNotificationsFailed,
  }
}

export interface AccountDeletionCleanupResult {
  scannedUsers: number
  finalizedUsers: number
  eventsCancelled: number
  attendeeNotificationsSent: number
  attendeeNotificationsFailed: number
  limit: number
  runAt: string
}

export async function cleanupDueAccountDeletions(limit?: number): Promise<AccountDeletionCleanupResult> {
  const normalizedLimit = normalizeCleanupLimit(limit)
  const now = new Date()

  const dueUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      deletionScheduledFor: {
        lte: now,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      deletionScheduledFor: 'asc',
    },
    take: normalizedLimit,
  })

  let finalizedUsers = 0
  let eventsCancelled = 0
  let attendeeNotificationsSent = 0
  let attendeeNotificationsFailed = 0

  for (const dueUser of dueUsers) {
    const result = await finalizeAccountDeletionForUser(dueUser.id)
    if (!result.finalized) {
      continue
    }

    finalizedUsers += 1
    eventsCancelled += result.eventsCancelled
    attendeeNotificationsSent += result.attendeeNotificationsSent
    attendeeNotificationsFailed += result.attendeeNotificationsFailed
  }

  return {
    scannedUsers: dueUsers.length,
    finalizedUsers,
    eventsCancelled,
    attendeeNotificationsSent,
    attendeeNotificationsFailed,
    limit: normalizedLimit,
    runAt: now.toISOString(),
  }
}

export function getAccountDeletionGracePeriodDays(): number {
  return ACCOUNT_DELETION_GRACE_PERIOD_DAYS
}
