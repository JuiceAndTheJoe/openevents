export const VAT_RATE = 0.25
export const VAT_MULTIPLIER = 1 + VAT_RATE

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(amountInCents: number): number {
  return Number((amountInCents / 100).toFixed(2))
}

export function getPriceIncludingVat(priceExcludingVat: number, vatRate: number = VAT_RATE): number {
  const multiplier = 1 + vatRate
  const priceExcludingVatCents = toCents(priceExcludingVat)
  const priceIncludingVatCents = Math.round(priceExcludingVatCents * multiplier)
  return fromCents(priceIncludingVatCents)
}

export function getIncludedVatFromVatInclusiveTotal(totalIncludingVat: number, vatRate: number = VAT_RATE): number {
  const multiplier = 1 + vatRate
  const totalIncludingVatCents = toCents(totalIncludingVat)
  const totalExcludingVatCents = Math.round(totalIncludingVatCents / multiplier)
  return fromCents(totalIncludingVatCents - totalExcludingVatCents)
}
