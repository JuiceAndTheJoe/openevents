import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TicketTypeFormProps = {
  title: string
  submitLabel: string
  action: (formData: FormData) => Promise<void>
  initial?: {
    id: string
    name: string
    description: string | null
    price: number
    currency: string
    maxCapacity: number | null
    minPerOrder: number
    maxPerOrder: number
    isVisible: boolean
  }
}

export function TicketTypeForm({ title, submitLabel, action, initial }: TicketTypeFormProps) {
  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {initial ? <input type="hidden" name="ticketTypeId" value={initial.id} /> : null}
      <div>
        <Label htmlFor={`${title}-name`} required>Name</Label>
        <Input id={`${title}-name`} name="name" defaultValue={initial?.name || ''} required />
      </div>
      <div>
        <Label htmlFor={`${title}-description`}>Description</Label>
        <textarea
          id={`${title}-description`}
          name="description"
          defaultValue={initial?.description || ''}
          className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={`${title}-price`} required>Price</Label>
          <Input id={`${title}-price`} name="price" type="number" min="0" step="0.01" defaultValue={initial?.price ?? 0} required />
        </div>
        <div>
          <Label htmlFor={`${title}-currency`} required>Currency</Label>
          <Input id={`${title}-currency`} name="currency" defaultValue={initial?.currency || 'SEK'} required />
        </div>
        <div>
          <Label htmlFor={`${title}-capacity`}>Max Capacity</Label>
          <Input id={`${title}-capacity`} name="maxCapacity" type="number" min="1" defaultValue={initial?.maxCapacity ?? ''} placeholder="Leave empty for unlimited" />
        </div>
        <div>
          <Label htmlFor={`${title}-visible`}>Visibility</Label>
          <select
            id={`${title}-visible`}
            name="isVisible"
            defaultValue={initial?.isVisible === false ? 'false' : 'true'}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="true">Visible</option>
            <option value="false">Hidden</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor={`${title}-min`}>Min per Order</Label>
          <Input id={`${title}-min`} name="minPerOrder" type="number" min="1" defaultValue={initial?.minPerOrder ?? 1} />
        </div>
        <div>
          <Label htmlFor={`${title}-max`}>Max per Order</Label>
          <Input id={`${title}-max`} name="maxPerOrder" type="number" min="1" defaultValue={initial?.maxPerOrder ?? 10} />
        </div>
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  )
}
