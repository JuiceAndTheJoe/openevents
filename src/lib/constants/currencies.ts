// PayPal-supported currencies for checkout.
// Source: https://developer.paypal.com/api/rest/reference/currency-codes/
export const SUPPORTED_CURRENCIES = [
  'AUD',
  'BRL',
  'CAD',
  'CZK',
  'DKK',
  'EUR',
  'HKD',
  'HUF',
  'ILS',
  'JPY',
  'MYR',
  'MXN',
  'TWD',
  'NZD',
  'NOK',
  'PHP',
  'PLN',
  'GBP',
  'SGD',
  'SEK',
  'CHF',
  'THB',
  'USD',
] as const

export const DEFAULT_CURRENCY = 'SEK' as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(value as SupportedCurrency)
}
