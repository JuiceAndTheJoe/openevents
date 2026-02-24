/**
 * Calendar Integration Utilities
 *
 * Generate "Add to Calendar" links for various calendar services.
 */

export interface CalendarEvent {
  title: string
  description?: string
  location?: string
  startDate: Date
  endDate: Date
  url?: string
}

/**
 * Format date for Google Calendar URL (YYYYMMDDTHHMMSSZ)
 */
function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Format date for Outlook/Office365 (ISO 8601)
 */
function formatOutlookDate(date: Date): string {
  return date.toISOString()
}

/**
 * Generate Google Calendar "Add to Calendar" URL
 *
 * @see https://github.com/nicokosi/about-add-to-calendar-links
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
  })

  if (event.description) {
    params.set('details', event.description)
  }

  if (event.location) {
    params.set('location', event.location)
  }

  if (event.url) {
    // Append URL to details
    const details = event.description
      ? `${event.description}\n\nMore info: ${event.url}`
      : `More info: ${event.url}`
    params.set('details', details)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Generate Outlook.com "Add to Calendar" URL
 */
export function generateOutlookUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatOutlookDate(event.startDate),
    enddt: formatOutlookDate(event.endDate),
  })

  if (event.description) {
    params.set('body', event.description)
  }

  if (event.location) {
    params.set('location', event.location)
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Generate Office 365 "Add to Calendar" URL
 */
export function generateOffice365Url(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatOutlookDate(event.startDate),
    enddt: formatOutlookDate(event.endDate),
  })

  if (event.description) {
    params.set('body', event.description)
  }

  if (event.location) {
    params.set('location', event.location)
  }

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Generate Yahoo Calendar "Add to Calendar" URL
 */
export function generateYahooCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: formatGoogleDate(event.startDate),
    et: formatGoogleDate(event.endDate),
  })

  if (event.description) {
    params.set('desc', event.description)
  }

  if (event.location) {
    params.set('in_loc', event.location)
  }

  return `https://calendar.yahoo.com/?${params.toString()}`
}

/**
 * Generate iCal download URL (for Apple Calendar and others)
 *
 * @param eventSlug - The event slug
 * @param baseUrl - The base URL of the application
 */
export function generateICalUrl(eventSlug: string, baseUrl?: string): string {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/events/${eventSlug}/calendar`
}

/**
 * Generate all calendar URLs for an event
 */
export function generateAllCalendarUrls(
  event: CalendarEvent,
  eventSlug: string,
  baseUrl?: string
): {
  google: string
  outlook: string
  office365: string
  yahoo: string
  ical: string
} {
  return {
    google: generateGoogleCalendarUrl(event),
    outlook: generateOutlookUrl(event),
    office365: generateOffice365Url(event),
    yahoo: generateYahooCalendarUrl(event),
    ical: generateICalUrl(eventSlug, baseUrl),
  }
}
