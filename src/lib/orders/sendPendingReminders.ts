import { prisma } from '@/lib/db'
import { sendPendingOrderReminderEmail } from '@/lib/email'
import { formatDateTime } from '@/lib/utils'

const REMINDER_DELAY_HOURS = 5
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

export interface PendingReminderResult {
  scanned: number
  sent: number
  failed: number
  limit: number
  runAt: string
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export async function sendPendingOrderReminders(options?: {
  limit?: number
  eventId?: string
}): Promise<PendingReminderResult> {
  const limit = normalizeLimit(options?.limit)
  const now = new Date()
  const cutoff = new Date(now.getTime() - REMINDER_DELAY_HOURS * 60 * 60 * 1000)

  const orders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      paidAt: null,
      cancelledAt: null,
      reminderSentAt: null,
      createdAt: { lte: cutoff },
      ...(options?.eventId ? { eventId: options.eventId } : {}),
    },
    select: {
      id: true,
      orderNumber: true,
      buyerFirstName: true,
      buyerLastName: true,
      buyerEmail: true,
      event: {
        select: {
          title: true,
          slug: true,
          startDate: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let sent = 0
  let failed = 0

  for (const order of orders) {
    try {
      await sendPendingOrderReminderEmail(order.buyerEmail, {
        buyerName: `${order.buyerFirstName} ${order.buyerLastName}`.trim(),
        orderNumber: order.orderNumber,
        eventTitle: order.event.title,
        eventDate: formatDateTime(order.event.startDate),
        eventSlug: order.event.slug,
      })

      await prisma.order.update({
        where: { id: order.id },
        data: { reminderSentAt: new Date() },
      })

      sent += 1
    } catch (error) {
      console.error(`Failed to send pending-order reminder for ${order.orderNumber}:`, error)
      failed += 1
    }
  }

  return {
    scanned: orders.length,
    sent,
    failed,
    limit,
    runAt: now.toISOString(),
  }
}
