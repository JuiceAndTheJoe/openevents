import { COUNTRIES } from './countries'

export const DEFAULT_VAT_RATE = 0.25

// ISO 3166-1 alpha-2 country code → VAT rate
export const VAT_RATES: Record<string, number> = {
  // EU member states
  AT: 0.20, // Austria
  BE: 0.21, // Belgium
  BG: 0.20, // Bulgaria
  CY: 0.19, // Cyprus
  CZ: 0.21, // Czech Republic
  DE: 0.19, // Germany
  DK: 0.25, // Denmark
  EE: 0.22, // Estonia
  ES: 0.21, // Spain
  FI: 0.255, // Finland
  FR: 0.20, // France
  GR: 0.24, // Greece
  HR: 0.25, // Croatia
  HU: 0.27, // Hungary
  IE: 0.23, // Ireland
  IT: 0.22, // Italy
  LT: 0.21, // Lithuania
  LU: 0.17, // Luxembourg
  LV: 0.21, // Latvia
  MT: 0.18, // Malta
  NL: 0.21, // Netherlands
  PL: 0.23, // Poland
  PT: 0.23, // Portugal
  RO: 0.19, // Romania
  SE: 0.25, // Sweden
  SI: 0.22, // Slovenia
  SK: 0.20, // Slovakia
  // Non-EU Europe
  CH: 0.081, // Switzerland
  GB: 0.20, // United Kingdom
  IS: 0.24, // Iceland
  LI: 0.081, // Liechtenstein
  NO: 0.25, // Norway
  // Americas
  BR: 0.12, // Brazil (federal rate approximation)
  CA: 0.05, // Canada (GST federal rate)
  MX: 0.16, // Mexico
  US: 0.00, // United States (no federal VAT)
  // Asia-Pacific
  AU: 0.10, // Australia
  CN: 0.13, // China
  HK: 0.00, // Hong Kong
  IN: 0.18, // India (GST standard rate)
  JP: 0.10, // Japan
  NZ: 0.15, // New Zealand
  SG: 0.09, // Singapore
  // Africa / Other
  ZA: 0.15, // South Africa
}

export function getVatRateForCountry(countryCode: string): number {
  if (!countryCode) return DEFAULT_VAT_RATE
  return VAT_RATES[countryCode.toUpperCase()] ?? DEFAULT_VAT_RATE
}

/**
 * Resolves a free-text country name (e.g. "Netherlands") or ISO code (e.g. "NL")
 * to a VAT rate. Falls back to DEFAULT_VAT_RATE when no match is found.
 * Intended for use where the country is entered as plain text by the user.
 */
export function getVatRateForCountryNameOrCode(input: string): number {
  if (!input) return DEFAULT_VAT_RATE

  // Try direct ISO code lookup first
  const byCode = VAT_RATES[input.toUpperCase()]
  if (byCode !== undefined) return byCode

  // Fall back to case-insensitive name lookup
  const normalised = input.trim().toLowerCase()
  const match = COUNTRIES.find((c) => c.name.toLowerCase() === normalised)
  if (match) return VAT_RATES[match.code] ?? DEFAULT_VAT_RATE

  return DEFAULT_VAT_RATE
}
