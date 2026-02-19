import { OrderStatus, PaymentMethod } from '@prisma/client'

type OrderFiltersProps = {
  initial: {
    search?: string
    status?: OrderStatus | ''
    paymentMethod?: PaymentMethod | ''
    dateFrom?: string
    dateTo?: string
  }
}

export function OrderFilters({ initial }: OrderFiltersProps) {
  return (
    <form className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-6">
      <div className="md:col-span-2">
        <label htmlFor="search" className="text-xs font-medium text-gray-600">Search buyer / email / order #</label>
        <input
          id="search"
          name="search"
          defaultValue={initial.search || ''}
          className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="status" className="text-xs font-medium text-gray-600">Status</label>
        <select id="status" name="status" defaultValue={initial.status || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm">
          <option value="">All</option>
          <option value="PENDING">PENDING</option>
          <option value="PENDING_INVOICE">PENDING_INVOICE</option>
          <option value="PAID">PAID</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="REFUNDED">REFUNDED</option>
          <option value="PARTIALLY_REFUNDED">PARTIALLY_REFUNDED</option>
        </select>
      </div>
      <div>
        <label htmlFor="paymentMethod" className="text-xs font-medium text-gray-600">Payment</label>
        <select id="paymentMethod" name="paymentMethod" defaultValue={initial.paymentMethod || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm">
          <option value="">All</option>
          <option value="PAYPAL">PAYPAL</option>
          <option value="INVOICE">INVOICE</option>
          <option value="FREE">FREE</option>
        </select>
      </div>
      <div>
        <label htmlFor="dateFrom" className="text-xs font-medium text-gray-600">From</label>
        <input id="dateFrom" name="dateFrom" type="date" defaultValue={initial.dateFrom || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
      </div>
      <div>
        <label htmlFor="dateTo" className="text-xs font-medium text-gray-600">To</label>
        <input id="dateTo" name="dateTo" type="date" defaultValue={initial.dateTo || ''} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
      </div>
      <div className="md:col-span-6">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">Apply Filters</button>
      </div>
    </form>
  )
}
