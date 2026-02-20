import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '../src/lib/constants/currencies'

function run() {
  assert.ok(SUPPORTED_CURRENCIES.includes(DEFAULT_CURRENCY), 'Default currency must be supported')
  assert.ok(SUPPORTED_CURRENCIES.includes('SEK'), 'SEK must remain supported')

  const ticketValidationSource = readFileSync(
    path.join(process.cwd(), 'src/lib/validations/ticket.ts'),
    'utf8'
  )
  assert.ok(
    ticketValidationSource.includes('z.enum(SUPPORTED_CURRENCIES)'),
    'Backend ticket validation must use SUPPORTED_CURRENCIES'
  )

  const eventFormSource = readFileSync(
    path.join(process.cwd(), 'src/components/events/EventForm.tsx'),
    'utf8'
  )
  assert.ok(
    eventFormSource.includes('SUPPORTED_CURRENCIES.map'),
    'Event form currency UI must render SUPPORTED_CURRENCIES'
  )

  console.log('Currency checks passed')
}

run()
