'use client'

import { useRef } from 'react'

type BulkActionFormProps = {
  action: (formData: FormData) => Promise<void>
  orderCount: number
}

export function BulkActionForm({ action, orderCount }: BulkActionFormProps) {
  const selectRef = useRef<HTMLSelectElement>(null)

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const selected = selectRef.current?.value
        if (selected === 'delete_all_filtered') {
          if (!confirm(`Are you sure you want to permanently delete ${orderCount} order(s)? This cannot be undone.`)) {
            e.preventDefault()
          }
        }
      }}
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center gap-3">
        <select ref={selectRef} name="bulkAction" className="h-10 rounded-md border border-gray-300 px-3 text-sm">
          <option value="">Bulk actions</option>
          <option value="cancel_all_filtered">Cancel all pending orders</option>
          <option value="delete_all_filtered">Delete all filtered orders</option>
        </select>
        <button type="submit" className="h-10 rounded-md bg-[#5C8BD9] px-4 text-sm font-medium text-white">Apply</button>
      </div>
    </form>
  )
}
