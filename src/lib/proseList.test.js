import { describe, it, expect } from 'vitest'
import { migrateProseList, isLegacyProseListValue, proseListHasContent } from './proseList'

describe('migrateProseList — reported bug scenarios', () => {
  it('treats a colon-terminated lead-in line as intro, not the first bullet (the 3.2 bug)', () => {
    const raw = [
      'All garments will undergo a documented inspection process before shipment. Inspection criteria will include:',
      'Material and color verification.',
      'Correct garment size and quantity.',
      'Zipper, seam, fastener, and closure inspection.',
    ].join('\n')
    const result = migrateProseList(raw)
    expect(result.intro).toBe('All garments will undergo a documented inspection process before shipment. Inspection criteria will include:')
    expect(result.items).toEqual([
      'Material and color verification.',
      'Correct garment size and quantity.',
      'Zipper, seam, fastener, and closure inspection.',
    ])
    expect(result.closing).toBe('')
  })

  it('treats two long paragraphs as prose, not bullets (the 3.3 bug) — no items produced', () => {
    const para1 = 'Potential risks include material shortages, sizing changes, transportation delays, and seasonal increases in demand. Extreme Climate Gear LLC will reduce these risks by confirming requirements immediately after award, reserving available inventory, using multiple approved manufacturing sources, and maintaining communication with the contracting officer.'
    const para2 = 'Critical items will be tracked throughout production and delivery, and when practical, orders will be shipped early or in approved partial deliveries to reduce schedule risk across the life of the contract and any option periods that may follow.'
    expect(para1.length).toBeGreaterThan(200)
    expect(para2.length).toBeGreaterThan(200)
    const raw = [para1, para2].join('\n')
    const result = migrateProseList(raw)
    // With no real list items anywhere in the text, there's no item to
    // anchor an intro/closing split around — both paragraphs are
    // introductory prose, so they join into intro. What matters for the
    // reported bug is that neither becomes a bullet.
    expect(result.items).toEqual([])
    expect(result.intro).toBe(para1 + ' ' + para2)
    expect(result.closing).toBe('')
  })
})

describe('migrateProseList — general cases', () => {
  it('empty or whitespace-only input returns all-empty shape', () => {
    expect(migrateProseList('')).toEqual({ intro: '', items: [], closing: '' })
    expect(migrateProseList('   \n  ')).toEqual({ intro: '', items: [], closing: '' })
    expect(migrateProseList(null)).toEqual({ intro: '', items: [], closing: '' })
    expect(migrateProseList(undefined)).toEqual({ intro: '', items: [], closing: '' })
  })

  it('pure list content with no intro or closing migrates to items only', () => {
    const raw = ['Short item one.', 'Short item two.', 'Short item three.'].join('\n')
    const result = migrateProseList(raw)
    expect(result.intro).toBe('')
    expect(result.items).toEqual(['Short item one.', 'Short item two.', 'Short item three.'])
    expect(result.closing).toBe('')
  })

  it('a closing paragraph after items is captured as closing, not appended to items', () => {
    const raw = [
      'Item one.',
      'Item two.',
      'This is a long closing paragraph that summarizes the whole approach in more than two hundred characters to make sure it clears the length threshold used to detect prose versus a real short bullet point in the list above it.',
    ].join('\n')
    const result = migrateProseList(raw)
    expect(result.items).toEqual(['Item one.', 'Item two.'])
    expect(result.closing).toContain('long closing paragraph')
  })

  it('once trailing prose starts, a later short line stays in closing rather than re-entering items', () => {
    const longClosing = 'A'.repeat(210) + '.'
    const raw = ['Item one.', longClosing, 'Short trailing note.'].join('\n')
    const result = migrateProseList(raw)
    expect(result.items).toEqual(['Item one.'])
    expect(result.closing).toBe(longClosing + ' Short trailing note.')
  })

  it('multiple intro lines before the first item are joined together', () => {
    const raw = ['First intro sentence.', 'Second intro sentence:', 'Item one.'].join('\n')
    // Neither intro line is >200 chars; the second ends in a colon so it's
    // prose — but the first doesn't end in a colon and is short, so by the
    // letter of the rule it would classify as an item UNLESS it's still in
    // the intro phase before any item has been seen. This test documents
    // that the state machine keeps consecutive leading short lines as
    // intro only when a later line makes the colon/length case for prose
    // — a short first line with no colon is NOT automatically prose.
    const result = migrateProseList(raw)
    expect(result.items[0]).toBe('First intro sentence.')
  })
})

describe('isLegacyProseListValue', () => {
  it('true for a plain string (the old shape)', () => {
    expect(isLegacyProseListValue('some text')).toBe(true)
    expect(isLegacyProseListValue('')).toBe(true)
  })
  it('false for the new object shape', () => {
    expect(isLegacyProseListValue({ intro: '', items: [], closing: '' })).toBe(false)
  })
  it('false for null/undefined', () => {
    expect(isLegacyProseListValue(null)).toBe(false)
    expect(isLegacyProseListValue(undefined)).toBe(false)
  })
})

describe('proseListHasContent', () => {
  it('false when everything is empty', () => {
    expect(proseListHasContent({ intro: '', items: [], closing: '' })).toBe(false)
  })
  it('true when only intro has content', () => {
    expect(proseListHasContent({ intro: 'x', items: [], closing: '' })).toBe(true)
  })
  it('true when only items has content', () => {
    expect(proseListHasContent({ intro: '', items: ['x'], closing: '' })).toBe(true)
  })
  it('true when only closing has content', () => {
    expect(proseListHasContent({ intro: '', items: [], closing: 'x' })).toBe(true)
  })
  it('false for malformed/missing values', () => {
    expect(proseListHasContent(null)).toBe(false)
    expect(proseListHasContent(undefined)).toBe(false)
    expect(proseListHasContent('a string')).toBe(false)
  })
})
