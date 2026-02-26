import { Button } from '@/components/ui/button'

type DiscountCodeListProps = {
  discountCodes: Array<{
    id: string
    code: string
    discountType: string
    discountValue: number
    usedCount: number
    maxUses: number | null
    isActive: boolean
  }>
  deleteAction: (formData: FormData) => Promise<void>
}

export function DiscountCodeList({ discountCodes, deleteAction }: DiscountCodeListProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Discount Codes</h2>
      {discountCodes.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">No discount codes configured.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {discountCodes.map((discountCode) => (
            <div key={discountCode.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="font-medium text-gray-900">{discountCode.code}</p>
                <p className="text-sm text-gray-600">
                  {discountCode.discountType} · Value: {discountCode.discountValue} · Tickets used: {discountCode.usedCount}/{discountCode.maxUses ?? 'Unlimited'} · {discountCode.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="discountCodeId" value={discountCode.id} />
                <Button variant="destructive" size="sm">Delete</Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
