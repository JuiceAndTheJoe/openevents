import { EventStatus } from '@prisma/client'

const statusStyles: Record<EventStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  PUBLISHED: 'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  COMPLETED: 'bg-blue-100 text-blue-700 border-blue-200',
}

type EventStatusBadgeProps = {
  status: EventStatus
}

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  )
}
