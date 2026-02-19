import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { TicketScanner } from '@/components/tickets/TicketScanner'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ScanTicketsPage({ params }: PageProps) {
  const { organizerProfile } = await requireOrganizerProfile()
  const { id } = await params

  const event = await prisma.event.findFirst({
    where: {
      id,
      organizerId: organizerProfile.id,
    },
    select: {
      id: true,
      title: true,
      slug: true,
    },
  })

  if (!event) {
    notFound()
  }

  const [checkedInCount, totalTickets] = await Promise.all([
    prisma.ticket.count({
      where: {
        status: 'USED',
        order: {
          eventId: event.id,
        },
      },
    }),
    prisma.ticket.count({
      where: {
        order: {
          eventId: event.id,
          status: { in: ['PAID', 'PENDING_INVOICE'] },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-gray-600">Ticket Check-in Scanner</p>
      </div>

      <div className="rounded-lg border bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Checked in: <span className="font-semibold">{checkedInCount}</span> / {totalTickets} tickets
        </p>
      </div>

      <TicketScanner eventId={event.id} />
    </div>
  )
}
