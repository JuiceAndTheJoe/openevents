function parseDateTimeLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

export function isValidTimeZone(timeZone: string) {
  if (!timeZone) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)

  const asUtc = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second')
  )

  return asUtc - date.getTime()
}

export function formatUtcInTimeZoneForInput(value?: string | null, timeZone = 'UTC') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : 'UTC'

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function dateTimeLocalInTimeZoneToUtcIso(value: string, timeZone: string) {
  const parsed = parseDateTimeLocal(value)
  if (!parsed) return null

  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : 'UTC'
  const utcFromLocalFields = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, 0, 0)
  let timestamp = utcFromLocalFields

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(timestamp), safeTimeZone)
    const nextTimestamp = utcFromLocalFields - offset
    if (nextTimestamp === timestamp) break
    timestamp = nextTimestamp
  }

  return new Date(timestamp).toISOString()
}

export function convertDateTimeLocalBetweenTimeZones(
  value: string,
  fromTimeZone: string,
  toTimeZone: string
) {
  if (!value) return ''

  const utcIso = dateTimeLocalInTimeZoneToUtcIso(value, fromTimeZone)
  if (!utcIso) return ''

  return formatUtcInTimeZoneForInput(utcIso, toTimeZone)
}
