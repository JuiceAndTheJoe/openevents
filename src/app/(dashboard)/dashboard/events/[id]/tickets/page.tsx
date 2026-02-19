import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile } from '@/lib/dashboard/organizer'
import { TicketTypeList } from '@/components/dashboard/TicketTypeList'
import { TicketTypeForm } from '@/components/dashboard/TicketTypeForm'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function TicketTypesPage({ params, searchParams }: PageProps) {
  const { organizerProfile } = await requireOrganizerProfile()
  const { id } = await params
  const qs = await searchParams
  const editId = readParam(qs.edit)

  const event = await prisma.event.findFirst({
    where: {
      id,
      organizerId: organizerProfile.id,
    },
    select: {
      id: true,
      title: true,
      ticketTypes: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          soldCount: true,
          maxCapacity: true,
          minPerOrder: true,
          maxPerOrder: true,
          isVisible: true,
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  async function createTicketType(formData: FormData) {
    'use server'

    const { organizerProfile: profile } = await requireOrganizerProfile()

    const eventCheck = await prisma.event.findFirst({
      where: { id, organizerId: profile.id },
      select: { id: true },
    })

    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const name = String(formData.get('name') || '').trim()
    const description = String(formData.get('description') || '').trim() || null
    const price = new Prisma.Decimal(String(formData.get('price') || '0'))
    const currency = String(formData.get('currency') || 'SEK').trim() || 'SEK'
    const maxCapacityRaw = String(formData.get('maxCapacity') || '').trim()
    const maxCapacity = maxCapacityRaw ? Number(maxCapacityRaw) : null
    const minPerOrder = Number(String(formData.get('minPerOrder') || '1'))
    const maxPerOrder = Number(String(formData.get('maxPerOrder') || '10'))
    const isVisible = String(formData.get('isVisible') || 'true') === 'true'

    await prisma.ticketType.create({
      data: {
        eventId: eventCheck.id,
        name,
        description,
        price,
        currency,
        maxCapacity,
        minPerOrder,
        maxPerOrder,
        isVisible,
      },
    })

    revalidatePath(`/dashboard/events/${id}/tickets`)
  }

  async function updateTicketType(formData: FormData) {
    'use server'

    const { organizerProfile: profile } = await requireOrganizerProfile()

    const ticketTypeId = String(formData.get('ticketTypeId') || '')
    if (!ticketTypeId) return

    const ticketType = await prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
        event: {
          id,
          organizerId: profile.id,
        },
      },
      select: { id: true },
    })

    if (!ticketType) {
      throw new Error('Ticket type not found')
    }

    const name = String(formData.get('name') || '').trim()
    const description = String(formData.get('description') || '').trim() || null
    const price = new Prisma.Decimal(String(formData.get('price') || '0'))
    const currency = String(formData.get('currency') || 'SEK').trim() || 'SEK'
    const maxCapacityRaw = String(formData.get('maxCapacity') || '').trim()
    const maxCapacity = maxCapacityRaw ? Number(maxCapacityRaw) : null
    const minPerOrder = Number(String(formData.get('minPerOrder') || '1'))
    const maxPerOrder = Number(String(formData.get('maxPerOrder') || '10'))
    const isVisible = String(formData.get('isVisible') || 'true') === 'true'

    await prisma.ticketType.update({
      where: { id: ticketType.id },
      data: {
        name,
        description,
        price,
        currency,
        maxCapacity,
        minPerOrder,
        maxPerOrder,
        isVisible,
      },
    })

    revalidatePath(`/dashboard/events/${id}/tickets`)
  }

  async function deleteTicketType(formData: FormData) {
    'use server'

    const { organizerProfile: profile } = await requireOrganizerProfile()
    const ticketTypeId = String(formData.get('ticketTypeId') || '')

    const ticketType = await prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
        event: {
          id,
          organizerId: profile.id,
        },
      },
      select: {
        id: true,
        soldCount: true,
      },
    })

    if (!ticketType) return

    if (ticketType.soldCount > 0) {
      throw new Error('Cannot delete a ticket type with sold tickets')
    }

    await prisma.ticketType.delete({
      where: { id: ticketType.id },
    })

    revalidatePath(`/dashboard/events/${id}/tickets`)
  }

  const editableTicketType = editId ? event.ticketTypes.find((ticketType) => ticketType.id === editId) : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ticket Types</h1>
        <p className="text-gray-600">Manage ticket inventory and pricing for {event.title}.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TicketTypeForm title="Create Ticket Type" submitLabel="Create Ticket Type" action={createTicketType} />
        <TicketTypeForm
          title="Edit Ticket Type"
          submitLabel="Update Ticket Type"
          action={updateTicketType}
          initial={
            editableTicketType
              ? {
                  id: editableTicketType.id,
                  name: editableTicketType.name,
                  description: editableTicketType.description,
                  price: Number(editableTicketType.price.toString()),
                  currency: editableTicketType.currency,
                  maxCapacity: editableTicketType.maxCapacity,
                  minPerOrder: editableTicketType.minPerOrder,
                  maxPerOrder: editableTicketType.maxPerOrder,
                  isVisible: editableTicketType.isVisible,
                }
              : undefined
          }
        />
      </div>

      <TicketTypeList
        ticketTypes={event.ticketTypes.map((ticketType) => ({
          id: ticketType.id,
          name: ticketType.name,
          price: Number(ticketType.price.toString()),
          currency: ticketType.currency,
          soldCount: ticketType.soldCount,
          maxCapacity: ticketType.maxCapacity,
          isVisible: ticketType.isVisible,
        }))}
        deleteAction={deleteTicketType}
      />

      <p className="text-xs text-gray-500">Tip: add <code>?edit=ticketTypeId</code> to the URL to prefill the edit form for a specific ticket type.</p>
    </div>
  )
}
