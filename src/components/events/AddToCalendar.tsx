'use client'

/**
 * Add to Calendar Button Component
 *
 * Provides a dropdown menu with options to add an event to various calendar services:
 * - Google Calendar
 * - Apple Calendar (iCal download)
 * - Outlook.com
 * - Office 365
 * - Yahoo Calendar
 */
import { useState } from 'react'
import { Calendar, ChevronDown, Download } from 'lucide-react'
import {
  generateGoogleCalendarUrl,
  generateOutlookUrl,
  generateOffice365Url,
  generateYahooCalendarUrl,
  generateICalUrl,
  type CalendarEvent,
} from '@/lib/calendar'

interface AddToCalendarProps {
  event: CalendarEvent
  eventSlug: string
  className?: string
}

export function AddToCalendar({ event, eventSlug, className = '' }: AddToCalendarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const calendarOptions = [
    {
      name: 'Google Calendar',
      icon: '📅',
      url: generateGoogleCalendarUrl(event),
      external: true,
    },
    {
      name: 'Apple Calendar',
      icon: '🍎',
      url: generateICalUrl(eventSlug),
      external: false,
      download: true,
    },
    {
      name: 'Outlook.com',
      icon: '📧',
      url: generateOutlookUrl(event),
      external: true,
    },
    {
      name: 'Office 365',
      icon: '💼',
      url: generateOffice365Url(event),
      external: true,
    },
    {
      name: 'Yahoo Calendar',
      icon: '📆',
      url: generateYahooCalendarUrl(event),
      external: true,
    },
    {
      name: 'Download .ics',
      icon: '⬇️',
      url: generateICalUrl(eventSlug),
      external: false,
      download: true,
    },
  ]

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Calendar className="w-4 h-4" />
        <span>Add to Calendar</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close menu on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown menu */}
          <div
            className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1" role="none">
              {calendarOptions.map((option) => (
                <a
                  key={option.name}
                  href={option.url}
                  target={option.external ? '_blank' : undefined}
                  rel={option.external ? 'noopener noreferrer' : undefined}
                  download={option.download ? `${eventSlug}.ics` : undefined}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                >
                  <span className="text-lg" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span>{option.name}</span>
                  {option.download && (
                    <Download className="w-3 h-3 ml-auto text-gray-400" />
                  )}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
