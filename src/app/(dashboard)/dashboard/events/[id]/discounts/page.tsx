import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { DiscountType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrganizerProfile, buildEventWhereClause, canAccessEvent } from '@/lib/dashboard/organizer'
import { DiscountCodeForm } from '@/components/dashboard/DiscountCodeForm'
import { DiscountCodeList } from '@/components/dashboard/DiscountCodeList'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function DiscountCodesPage({ params, searchParams }: PageProps) {
  await requireOrganizerProfile()
  const { id } = await params
  const qs = await searchParams
  const editId = readParam(qs.edit)

  const where = buildEventWhereClause(null, true, { id })

  const event = await prisma.event.findFirst({
    where,
    select: {
      id: true,
      title: true,
      discountCodes: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
          maxUses: true,
          minCartAmount: true,
          maxTicketsPerOrder: true,
          usedCount: true,
          isActive: true,
          applyToWholeOrder: true,
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  async function createDiscountCode(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)

    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const code = String(formData.get('code') || '').trim().toUpperCase()
    const discountType = String(formData.get('discountType') || 'PERCENTAGE') as DiscountType
    const discountValue = new Prisma.Decimal(String(formData.get('discountValue') || '0'))
    const maxUsesRaw = String(formData.get('maxUses') || '').trim()
    const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null
    const minCartAmountRaw = String(formData.get('minCartAmount') || '').trim()
    const minCartAmount = minCartAmountRaw ? new Prisma.Decimal(minCartAmountRaw) : null
    const maxTicketsPerOrderRaw = String(formData.get('maxTicketsPerOrder') || '').trim()
    const maxTicketsPerOrder = maxTicketsPerOrderRaw ? Number(maxTicketsPerOrderRaw) : null
    const isActive = String(formData.get('isActive') || 'true') === 'true'
    const applyToWholeOrder = discountType === 'FREE_TICKET' ? true : formData.get('applyToWholeOrder') === 'on'

    await prisma.discountCode.create({
      data: {
        eventId: eventCheck.id,
        code,
        discountType,
        discountValue,
        maxUses,
        minCartAmount,
        maxTicketsPerOrder,
        isActive,
        applyToWholeOrder,
      },
    })

    revalidatePath(`/dashboard/events/${id}/discounts`)
  }

  async function updateDiscountCode(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) {
      throw new Error('Event not found')
    }

    const discountCodeId = String(formData.get('discountCodeId') || '')
    if (!discountCodeId) return

    const existing = await prisma.discountCode.findFirst({
      where: { id: discountCodeId, event: { id, deletedAt: null } },
      select: { id: true },
    })

    if (!existing) {
      throw new Error('Discount code not found')
    }

    const code = String(formData.get('code') || '').trim().toUpperCase()
    const discountType = String(formData.get('discountType') || 'PERCENTAGE') as DiscountType
    const discountValue = new Prisma.Decimal(String(formData.get('discountValue') || '0'))
    const maxUsesRaw = String(formData.get('maxUses') || '').trim()
    const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null
    const minCartAmountRaw = String(formData.get('minCartAmount') || '').trim()
    const minCartAmount = minCartAmountRaw ? new Prisma.Decimal(minCartAmountRaw) : null
    const maxTicketsPerOrderRaw = String(formData.get('maxTicketsPerOrder') || '').trim()
    const maxTicketsPerOrder = maxTicketsPerOrderRaw ? Number(maxTicketsPerOrderRaw) : null
    const isActive = String(formData.get('isActive') || 'true') === 'true'
    const applyToWholeOrder = discountType === 'FREE_TICKET' ? true : formData.get('applyToWholeOrder') === 'on'

    await prisma.discountCode.update({
      where: { id: existing.id },
      data: {
        code,
        discountType,
        discountValue,
        maxUses,
        minCartAmount,
        maxTicketsPerOrder,
        isActive,
        applyToWholeOrder,
      },
    })

    revalidatePath(`/dashboard/events/${id}/discounts`)
  }

  async function deleteDiscountCode(formData: FormData) {
    'use server'

    const { event: eventCheck } = await canAccessEvent(id)
    if (!eventCheck) return

    const discountCodeId = String(formData.get('discountCodeId') || '')

    const existing = await prisma.discountCode.findFirst({
      where: { id: discountCodeId, event: { id, deletedAt: null } },
      select: { id: true },
    })

    if (!existing) return

    await prisma.discountCode.delete({
      where: { id: existing.id },
    })

    revalidatePath(`/dashboard/events/${id}/discounts`)
  }

  const editableDiscountCode = editId ? event.discountCodes.find((code) => code.id === editId) : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Discount Codes</h1>
        <p className="text-gray-600">Manage discounts and usage limits for {event.title}.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DiscountCodeForm title="Create Discount Code" submitLabel="Create Discount Code" action={createDiscountCode} />
        <DiscountCodeForm
          title="Edit Discount Code"
          submitLabel="Update Discount Code"
          action={updateDiscountCode}
          initial={
            editableDiscountCode
              ? {
                  id: editableDiscountCode.id,
                  code: editableDiscountCode.code,
                  discountType: editableDiscountCode.discountType,
                  discountValue: Number(editableDiscountCode.discountValue.toString()),
                  maxUses: editableDiscountCode.maxUses,
                  minCartAmount: editableDiscountCode.minCartAmount ? Number(editableDiscountCode.minCartAmount.toString()) : null,
                  maxTicketsPerOrder: editableDiscountCode.maxTicketsPerOrder,
                  isActive: editableDiscountCode.isActive,
                  applyToWholeOrder: editableDiscountCode.applyToWholeOrder,
                }
              : undefined
          }
        />
      </div>

      <DiscountCodeList
        discountCodes={event.discountCodes.map((discountCode) => ({
          id: discountCode.id,
          code: discountCode.code,
          discountType: discountCode.discountType,
          discountValue: Number(discountCode.discountValue.toString()),
          usedCount: discountCode.usedCount,
          maxUses: discountCode.maxUses,
          isActive: discountCode.isActive,
        }))}
        deleteAction={deleteDiscountCode}
      />

      <p className="text-xs text-gray-500">Tip: add <code>?edit=discountCodeId</code> to the URL to prefill the edit form for a specific code.</p>
    </div>
  )
}
