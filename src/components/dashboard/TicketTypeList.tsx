import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

type TicketTypeListProps = {
  ticketTypes: Array<{
    id: string
    name: string
    price: number
    currency: string
    soldCount: number
    maxCapacity: number | null
    isVisible: boolean
  }>
  deleteAction: (formData: FormData) => Promise<void>
}

export function TicketTypeList({ ticketTypes, deleteAction }: TicketTypeListProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Ticket Types</h2>
      {ticketTypes.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">No ticket types configured.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {ticketTypes.map((ticketType) => (
            <div key={ticketType.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="font-medium text-gray-900">{ticketType.name}</p>
                <p className="text-sm text-gray-600">
                  {formatCurrency(ticketType.price, ticketType.currency)} · Sold: {ticketType.soldCount} · Capacity: {ticketType.maxCapacity ?? 'Unlimited'} · {ticketType.isVisible ? 'Visible' : 'Hidden'}
                </p>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="ticketTypeId" value={ticketType.id} />
                <Button variant="destructive" size="sm">Delete</Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
