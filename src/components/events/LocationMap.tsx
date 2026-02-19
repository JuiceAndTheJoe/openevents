import { LocationType } from '@prisma/client'

type LocationMapProps = {
  locationType: LocationType
  venue: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
}

export function LocationMap({ locationType, venue, address, city, state, country }: LocationMapProps) {
  if (locationType === 'ONLINE') {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
        This is an online event. No physical map is required.
      </div>
    )
  }

  const query = encodeURIComponent([venue, address, city, state, country].filter(Boolean).join(', '))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-gray-900">Location Map</h3>
      <p className="mt-1 text-sm text-gray-600">Map preview opens in Google Maps.</p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        Open map
      </a>
    </div>
  )
}
