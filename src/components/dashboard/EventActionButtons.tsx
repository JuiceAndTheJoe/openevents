'use client'

import Link from 'next/link'
import { ChevronDown, Download } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'

type Props = {
  eventId: string
  eventSlug: string
}

const itemClass =
  'flex cursor-pointer select-none items-center px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-50 focus:bg-gray-50 rounded'

export function EventActionButtons({ eventId, eventSlug }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      {/* Edit Event button */}
      <Link href={`/dashboard/events/${eventId}/edit`}>
        <Button variant="outline">Edit Event</Button>
      </Link>

      {/* Export dropdown: CSV, Excel */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline">
            <Download className="mr-1 h-4 w-4" />
            Export
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            align="start"
            className="z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white p-1 shadow-md"
          >
            <DropdownMenu.Item asChild>
              <a
                href={`/api/dashboard/events/${eventId}/attendees/export`}
                download
                className={itemClass}
              >
                Export CSV
              </a>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <a
                href={`/api/dashboard/events/${eventId}/attendees/export-excel`}
                download
                className={itemClass}
              >
                Export Excel
              </a>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Primary actions */}
      <Link href={`/dashboard/events/${eventId}/orders`}>
        <Button variant="outline">View Orders</Button>
      </Link>
      <Link href={`/dashboard/events/${eventId}/scan`}>
        <Button variant="outline">Scan Tickets</Button>
      </Link>
      <Link href={`/events/${eventSlug}`} target="_blank" rel="noopener noreferrer">
        <Button>Open Public Page</Button>
      </Link>
    </div>
  )
}
