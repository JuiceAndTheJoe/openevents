/**
 * iCal Calendar Export API
 *
 * Returns an .ics file for the event that can be imported into
 * Google Calendar, Apple Calendar, Outlook, etc.
 *
 * GET /api/events/[id]/calendar
 *
 * Note: The `id` parameter can be either an event ID or slug.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function getRequestBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host') || ''

  if (!host) {
    const url = new URL(request.url)
    return `${url.protocol}//${url.host}`
  }

  const proto =
    forwardedProto ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Format a date to iCal format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Escape special characters in iCal text fields
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Fold long lines according to iCal spec (max 75 chars per line)
 */
function foldLine(line: string): string {
  const maxLength = 75
  if (line.length <= maxLength) return line

  const result: string[] = []
  let remaining = line

  while (remaining.length > maxLength) {
    result.push(remaining.slice(0, maxLength))
    remaining = ' ' + remaining.slice(maxLength)
  }
  result.push(remaining)

  return result.join('\r\n')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Try to find by slug first, then by ID
    let event = await prisma.event.findUnique({
      where: { slug: id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        timezone: true,
        locationType: true,
        venue: true,
        address: true,
        city: true,
        state: true,
        country: true,
        onlineUrl: true,
        organizer: {
          select: {
            orgName: true,
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    // If not found by slug, try by ID
    if (!event) {
      event = await prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          timezone: true,
          locationType: true,
          venue: true,
          address: true,
          city: true,
          state: true,
          country: true,
          onlineUrl: true,
          organizer: {
            select: {
              orgName: true,
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      })
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Build location string
    let location = ''
    if (event.locationType === 'ONLINE') {
      location = event.onlineUrl || 'Online Event'
    } else {
      const parts = [event.venue, event.address, event.city, event.state, event.country].filter(
        Boolean
      )
      location = parts.join(', ')
    }

    // Strip HTML from description
    const plainDescription = event.description
      ? event.description.replace(/<[^>]*>/g, '').trim()
      : ''

    // Generate iCal content
    const icalLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OpenEvents//Event Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@openevents`,
      `DTSTAMP:${formatICalDate(new Date())}`,
      `DTSTART:${formatICalDate(event.startDate)}`,
      `DTEND:${formatICalDate(event.endDate)}`,
      foldLine(`SUMMARY:${escapeICalText(event.title)}`),
    ]

    if (plainDescription) {
      icalLines.push(foldLine(`DESCRIPTION:${escapeICalText(plainDescription)}`))
    }

    if (location) {
      icalLines.push(foldLine(`LOCATION:${escapeICalText(location)}`))
    }

    if (event.organizer?.user) {
      const organizerName = [event.organizer.user.firstName, event.organizer.user.lastName]
        .filter(Boolean)
        .join(' ') || event.organizer.orgName
      if (organizerName && event.organizer.user.email) {
        icalLines.push(`ORGANIZER;CN=${escapeICalText(organizerName)}:mailto:${event.organizer.user.email}`)
      }
    }

    // Add URL to the event page
    const appUrl = getRequestBaseUrl(request)
    icalLines.push(`URL:${appUrl}/events/${event.slug}`)

    icalLines.push('END:VEVENT', 'END:VCALENDAR')

    const icalContent = icalLines.join('\r\n')

    // Return as downloadable .ics file
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('[Calendar] Error generating iCal:', error)
    return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 })
  }
}
