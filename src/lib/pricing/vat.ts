export const VAT_RATE = 0.25
export const VAT_MULTIPLIER = 1 + VAT_RATE

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(amountInCents: number): number {
  return Number((amountInCents / 100).toFixed(2))
}

export function getPriceIncludingVat(priceExcludingVat: number): number {
  const priceExcludingVatCents = toCents(priceExcludingVat)
  const priceIncludingVatCents = Math.round(priceExcludingVatCents * VAT_MULTIPLIER)
  return fromCents(priceIncludingVatCents)
}

export function getIncludedVatFromVatInclusiveTotal(totalIncludingVat: number): number {
  const totalIncludingVatCents = toCents(totalIncludingVat)
  const totalExcludingVatCents = Math.round(totalIncludingVatCents / VAT_MULTIPLIER)
  return fromCents(totalIncludingVatCents - totalExcludingVatCents)
}
