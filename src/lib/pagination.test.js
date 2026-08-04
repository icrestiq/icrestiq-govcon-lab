import { describe, it, expect } from 'vitest'
import { computePageMap, PAGE_CONTENT_HEIGHT_PX } from './pagination'

const FB = true   // forceBreak
const NB = false  // no forced break (flows)

describe('computePageMap — forced breaks', () => {
  it('each forced-break block gets its own page regardless of how short it is', () => {
    const blocks = [
      { id: 'a', heightPx: 100, forceBreak: FB },
      { id: 'b', heightPx: 100, forceBreak: FB },
      { id: 'c', heightPx: 100, forceBreak: FB },
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
    expect(map.get('c')).toBe(3)
  })

  it('a forced-break block that spans multiple pages pushes the next forced block further', () => {
    const blocks = [
      { id: 'a', heightPx: PAGE_CONTENT_HEIGHT_PX * 2.5, forceBreak: FB },
      { id: 'b', heightPx: 100, forceBreak: FB },
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(4) // 1 + 3 pages consumed by 'a'
  })
})

describe('computePageMap — flowing blocks', () => {
  it('flowing blocks that fit stay on the same page, no page number jump', () => {
    const blocks = [
      { id: 'a', heightPx: 200, forceBreak: FB },
      { id: 'b', heightPx: 200, forceBreak: NB },
      { id: 'c', heightPx: 200, forceBreak: NB },
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(1)
    expect(map.get('c')).toBe(1)
  })

  it('a flowing block that does not fit the remaining space jumps to a fresh page', () => {
    const blocks = [
      { id: 'a', heightPx: PAGE_CONTENT_HEIGHT_PX - 100, forceBreak: FB }, // leaves only 100px remaining
      { id: 'b', heightPx: 500, forceBreak: NB }, // doesn't fit in 100px remaining
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
  })

  it('the very first block flowing (no prior content) just starts on page 1', () => {
    const blocks = [{ id: 'a', heightPx: 300, forceBreak: NB }]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
  })

  it('a flowing block much taller than a page spans multiple pages, and the next flowing block continues from the leftover', () => {
    const blocks = [
      { id: 'a', heightPx: 100, forceBreak: FB },
      { id: 'tall', heightPx: PAGE_CONTENT_HEIGHT_PX * 1.5, forceBreak: NB },
      { id: 'after', heightPx: 100, forceBreak: NB },
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    // 'tall' (1296px) doesn't fit the 764px remaining on page 1, so it
    // jumps to a fresh page rather than starting there with a stranded
    // heading — this is the same "moves as a whole" behavior break-after:
    // avoid produces on headings in the real print CSS.
    expect(map.get('tall')).toBe(2)
    // tall spans page 2 and into page 3 (1296px = 1.5 pages), leaving
    // 432px used on page 3 when 'after' starts.
    expect(map.get('after')).toBe(3)
  })
})

describe('computePageMap — failure and ambiguity handling', () => {
  it('returns an entirely empty map if any height is missing or invalid', () => {
    expect(computePageMap([{ id: 'a', heightPx: 400, forceBreak: FB }, { id: 'b', heightPx: NaN, forceBreak: NB }]).size).toBe(0)
    expect(computePageMap([{ id: 'a', heightPx: 0, forceBreak: FB }]).size).toBe(0)
  })

  it('returns an empty map for no blocks', () => {
    expect(computePageMap([]).size).toBe(0)
  })

  it('stops resolving when a flowing block is a near-exact fit for remaining space (ambiguous)', () => {
    const blocks = [
      { id: 'a', heightPx: PAGE_CONTENT_HEIGHT_PX - 100, forceBreak: FB }, // 100px remaining
      { id: 'ambiguous', heightPx: 102, forceBreak: NB }, // within tolerance of the 100px remaining boundary
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    expect(map.has('ambiguous')).toBe(false)
  })

  it('stops resolving when a block\'s own height lands just over a page-count boundary', () => {
    const blocks = [
      { id: 'a', heightPx: 100, forceBreak: FB },
      { id: 'ambiguous', heightPx: PAGE_CONTENT_HEIGHT_PX * 1.005, forceBreak: FB },
      { id: 'after', heightPx: 100, forceBreak: FB },
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    // 'ambiguous' itself still gets a start page (it starts right after 'a'
    // forces a break, so ITS start is certain) — what's uncertain is how
    // many pages it spans, so nothing AFTER it resolves.
    expect(map.get('ambiguous')).toBe(2)
    expect(map.has('after')).toBe(false)
  })

  it('does not flag a comfortable fit as ambiguous', () => {
    const blocks = [
      { id: 'a', heightPx: 100, forceBreak: FB },
      { id: 'b', heightPx: 200, forceBreak: NB },
      { id: 'c', heightPx: 200, forceBreak: NB },
    ]
    const map = computePageMap(blocks)
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(1)
    expect(map.get('c')).toBe(1)
  })
})
