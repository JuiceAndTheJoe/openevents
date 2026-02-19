type EventFiltersProps = {
  initial: {
    search?: string
    category?: string
    location?: string
    startDate?: string
    endDate?: string
  }
}

export function EventFilters({ initial }: EventFiltersProps) {
  return (
    <form className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-5" method="GET">
      <input
        name="search"
        defaultValue={initial.search}
        placeholder="Search events"
        className="h-10 rounded-md border border-gray-300 px-3 text-sm"
      />
      <input
        name="category"
        defaultValue={initial.category}
        placeholder="Category"
        className="h-10 rounded-md border border-gray-300 px-3 text-sm"
      />
      <input
        name="location"
        defaultValue={initial.location}
        placeholder="Location"
        className="h-10 rounded-md border border-gray-300 px-3 text-sm"
      />
      <input
        type="date"
        name="startDate"
        defaultValue={initial.startDate}
        className="h-10 rounded-md border border-gray-300 px-3 text-sm"
      />
      <input
        type="date"
        name="endDate"
        defaultValue={initial.endDate}
        className="h-10 rounded-md border border-gray-300 px-3 text-sm"
      />
      <div className="md:col-span-5 flex justify-end">
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Apply Filters
        </button>
      </div>
    </form>
  )
}
