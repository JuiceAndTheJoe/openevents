import { LocationType } from '@prisma/client'

type EventInfoProps = {
  startDate: Date
  endDate: Date
  timezone: string
  locationType: LocationType
  venue: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  onlineUrl: string | null
}

export function EventInfo({
  startDate,
  endDate,
  timezone,
  locationType,
  venue,
  address,
  city,
  state,
  country,
  onlineUrl,
}: EventInfoProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-gray-900">Event Information</h2>
      <div className="mt-4 space-y-3 text-sm text-gray-700">
        <p>
          <span className="font-semibold">Starts:</span>{' '}
          {new Date(startDate).toLocaleString()} ({timezone})
        </p>
        <p>
          <span className="font-semibold">Ends:</span>{' '}
          {new Date(endDate).toLocaleString()} ({timezone})
        </p>
        <p>
          <span className="font-semibold">Type:</span> {locationType}
        </p>
        {locationType !== 'ONLINE' ? (
          <p>
            <span className="font-semibold">Location:</span>{' '}
            {[venue, address, city, state, country].filter(Boolean).join(', ') || 'TBD'}
          </p>
        ) : null}
        {(locationType === 'ONLINE' || locationType === 'HYBRID') && onlineUrl ? (
          <p>
            <span className="font-semibold">Online URL:</span>{' '}
            <a href={onlineUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
              Join event
            </a>
          </p>
        ) : null}
      </div>
    </div>
  )
}
