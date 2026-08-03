// src/lib/pricing.test.js
import { describe, it, expect } from 'vitest'
import { toNumber, computeExtended, computeGrandTotal, formatCurrency } from './pricing'

describe('toNumber', () => {
  it('parses a plain number string', () => {
    expect(toNumber('219')).toBe(219)
  })
  it('strips a leading dollar sign and thousands separators', () => {
    expect(toNumber('$54,750.00')).toBe(54750)
  })
  it('returns 0 for blank, null, or undefined', () => {
    expect(toNumber('')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
  })
  it('returns 0 for garbage input rather than NaN', () => {
    expect(toNumber('EA')).toBe(0)
    expect(toNumber('n/a')).toBe(0)
  })
  it('passes real numbers through unchanged', () => {
    expect(toNumber(123000)).toBe(123000)
  })
})

describe('computeExtended', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeExtended(250, 219)).toBe(54750)
  })
  it('handles decimal unit prices', () => {
    expect(computeExtended(3, 19.99)).toBeCloseTo(59.97, 2)
  })
  it('is 0 if either side is blank', () => {
    expect(computeExtended('', 219)).toBe(0)
    expect(computeExtended(250, '')).toBe(0)
  })
})

describe('computeGrandTotal', () => {
  // The exact 4-line CLIN table from the bug report — real total is
  // 54750 + 37250 + 19500 + 11500 = 123000.
  const bugReportLineItems = [
    { quantity: 250, unitPrice: 219 },   // Extreme Cold Weather Insulated Parka
    { quantity: 250, unitPrice: 149 },   // Waterproof Insulated Shell Pants
    { quantity: 250, unitPrice: 78 },    // Moisture-Wicking Thermal Base-Layer Set
    { quantity: 250, unitPrice: 46 },    // Insulated Waterproof Cold-Weather Gloves
  ]

  it('sums the 4 real line items to 123000, not 0', () => {
    expect(computeGrandTotal(bugReportLineItems)).toBe(123000)
  })

  it('reproduces the original bug if fed the old formatted-string shape, to prove the fix matters', () => {
    // This is the OLD data shape (extPrice as a formatted string) run through
    // the OLD (buggy) approach, for contrast — not something the new code
    // ever does. Included so a future reader can see exactly what broke.
    const oldShapeRows = [
      { extPrice: '$54,750.00' },
      { extPrice: '$37,250.00' },
      { extPrice: '$19,500.00' },
      { extPrice: '$11,500.00' },
    ]
    const oldBuggyTotal = oldShapeRows.reduce((sum, row) => {
      const n = parseFloat(row.extPrice)
      return sum + (isNaN(n) ? 0 : n)
    }, 0)
    expect(oldBuggyTotal).toBe(0)
  })

  it('returns 0 for zero line items', () => {
    expect(computeGrandTotal([])).toBe(0)
  })

  it('handles decimal unit prices without floating-point drift breaking the total', () => {
    const rows = [
      { quantity: 3, unitPrice: 19.99 },
      { quantity: 2, unitPrice: 5.5 },
    ]
    expect(computeGrandTotal(rows)).toBeCloseTo(70.97, 2)
  })

  it('ignores rows with blank or garbage values instead of throwing', () => {
    const rows = [
      { quantity: 250, unitPrice: 219 },
      { quantity: '', unitPrice: '' },
      { quantity: 'n/a', unitPrice: 'n/a' },
    ]
    expect(computeGrandTotal(rows)).toBe(54750)
  })
})

describe('formatCurrency', () => {
  it('formats the bug-report total identically to a single line item: $ + thousands separator + 2 decimals', () => {
    expect(formatCurrency(123000)).toBe('$123,000.00')
  })
  it('formats a decimal amount to exactly 2 decimal places', () => {
    expect(formatCurrency(54750)).toBe('$54,750.00')
    expect(formatCurrency(19.9)).toBe('$19.90')
  })
  it('formats zero the same way as any other amount', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
})
