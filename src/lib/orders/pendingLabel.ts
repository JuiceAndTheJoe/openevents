export function getPendingOrderLabel(order: {
  status: string
  reminderSentAt?: Date | string | null
}): string | null {
  if (order.status !== 'PENDING') return null
  return order.reminderSentAt ? 'Reminder email sent' : 'Awaiting payment'
}
