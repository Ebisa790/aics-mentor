/**
 * Format a numeric amount as a locale-aware currency string.
 *
 * Examples:
 *   formatMoney(100)                  → "100.00"
 *   formatMoney(1500, 'ETB')          → "1,500.00 ETB"
 *   formatMoney(0.5)                  → "0.50"
 *   formatMoney(1234.5, 'ETB', false) → "1,234.50"   (currency hidden)
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency?: string | null,
  includeCurrency: boolean = true,
): string {
  if (amount === null || amount === undefined || amount === '') {
    return includeCurrency && currency ? `0.00 ${currency}` : '0.00'
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (Number.isNaN(num)) {
    return includeCurrency && currency ? `0.00 ${currency}` : '0.00'
  }

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (includeCurrency && currency) {
    return `${formatted} ${currency}`
  }
  return formatted
}