// src/lib/pricing.js
//
// Pure, framework-free math for the Proposal Builder's CLIN pricing table.
// Kept out of the component on purpose: currency formatting must only ever
// happen at render time, never before a value is summed or multiplied.
//
// THE BUG THIS REPLACES: the old code did
//   const n = parseFloat(row.extPrice)
// where extPrice was a free-text field the user typed a formatted dollar
// amount into (e.g. "$54,750.00"). parseFloat stops at the first character
// it can't parse — "$" — so it returned NaN for every row, which the old
// code silently coerced to 0. Every real line item summed to 0, so the
// printed total read "$0" no matter what the rows actually said.

/**
 * Coerce a possibly-formatted value ("$1,234.56", "1234.56", 1234.56, "",
 * null, undefined) into a plain finite number. Anything that isn't a real
 * number becomes 0, so a blank or malformed field contributes nothing to a
 * sum instead of poisoning it with NaN.
 */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * quantity * unitPrice, in numbers only. Never touches a formatted string,
 * never rounds — rounding only happens in formatCurrency, at display time.
 */
export function computeExtended(quantity, unitPrice) {
  return toNumber(quantity) * toNumber(unitPrice);
}

/**
 * Sums the extended price of every line item. Reduces numeric extendeds —
 * never parses a pre-formatted total or concatenated "250 EA"-style string.
 */
export function computeGrandTotal(pricingRows) {
  if (!Array.isArray(pricingRows)) return 0;
  return pricingRows.reduce((sum, row) => sum + computeExtended(row?.quantity, row?.unitPrice), 0);
}

/**
 * The only place a "$", a thousands separator, or a fixed 2-decimal count
 * gets added. Always renders like $123,000.00 — same format for a single
 * line item's unit price, its extended price, or the grand total.
 */
export function formatCurrency(amount) {
  return toNumber(amount).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Store/membership product price display — the numeric part only, no "$"
 * (callers render the currency symbol themselves in a separately-styled
 * span). Postgres numeric columns come back as strings like "47.00"; this
 * drops the trailing zeros to "47" so a whole-dollar price matches the
 * clean "$47" style already used elsewhere (e.g. the Membership page's
 * hardcoded tier copy), while a genuinely fractional price like "$1.50"
 * still shows its cents. Distinct from formatCurrency() above, which is
 * locked to the Proposal Builder's always-2-decimal invoice convention —
 * do not reuse that one here, the display conventions are deliberately
 * different.
 */
export function formatProductPriceAmount(amount) {
  const n = toNumber(amount);
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
