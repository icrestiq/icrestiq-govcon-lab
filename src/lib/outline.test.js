import { describe, it, expect } from 'vitest'
import { buildOutline, outlineDropdownOptions, flattenOutlineIds, findOutlineLabel } from './outline'

function baseData(overrides = {}) {
  return {
    complianceRows: [],
    requirementSummary: '',
    winThemes: '',
    companySnapshot: '',
    methodology: '',
    qualityControl: '',
    riskManagement: '',
    personnel: [{ name: '' }],
    pastPerformance: [{ contractNumber: '' }],
    pricing: [{ clin: '', description: '' }],
    basisOfEstimate: '',
    assumptions: '',
    deliverySchedule: [],
    warrantyPeriod: '',
    warrantyTerms: '',
    samRegistrationActive: false,
    setAsideCategories: [],
    ...overrides,
  }
}

describe('buildOutline numbering', () => {
  it('numbers Executive Summary as 1 when there is no compliance matrix', () => {
    const outline = buildOutline(baseData())
    expect(outline.find((s) => s.id === 'executive-summary').number).toBe('1')
    expect(outline.find((s) => s.id === 'price-proposal').number).toBe('5')
    expect(outline.some((s) => s.id === 'compliance-matrix')).toBe(false)
  })

  it('shifts everything down by one when the compliance matrix has rows', () => {
    const outline = buildOutline(baseData({ complianceRows: [{ id: '1', sectionId: 'key-personnel' }] }))
    expect(outline.find((s) => s.id === 'compliance-matrix').number).toBe('1')
    expect(outline.find((s) => s.id === 'executive-summary').number).toBe('2')
    expect(outline.find((s) => s.id === 'price-proposal').number).toBe('6')
  })

  it('subsection numbers follow their parent section number', () => {
    const outline = buildOutline(baseData({ methodology: 'x' }))
    const tech = outline.find((s) => s.id === 'technical-approach')
    const methodologySub = tech.subsections.find((s) => s.id === 'tech-methodology')
    expect(tech.number).toBe('2')
    expect(methodologySub.number).toBe('2.1')
  })
})

describe('filled-status detection', () => {
  it('marks a subsection unfilled when its field is blank', () => {
    const outline = buildOutline(baseData())
    const exec = outline.find((s) => s.id === 'executive-summary')
    expect(exec.subsections.every((s) => !s.filled)).toBe(true)
    expect(exec.filled).toBe(false)
  })

  it('marks a subsection filled when its field has real content', () => {
    const outline = buildOutline(baseData({ winThemes: 'Domestic small business.' }))
    const exec = outline.find((s) => s.id === 'executive-summary')
    expect(exec.subsections.find((s) => s.id === 'exec-winthemes').filled).toBe(true)
    expect(exec.filled).toBe(true)
  })

  it('whitespace-only content does not count as filled', () => {
    const outline = buildOutline(baseData({ winThemes: '   \n  ' }))
    const exec = outline.find((s) => s.id === 'executive-summary')
    expect(exec.subsections.find((s) => s.id === 'exec-winthemes').filled).toBe(false)
  })

  it('Key Personnel is filled only if at least one row has a name', () => {
    const empty = buildOutline(baseData())
    expect(empty.find((s) => s.id === 'key-personnel').filled).toBe(false)

    const filled = buildOutline(baseData({ personnel: [{ name: '' }, { name: 'Jane Doe' }] }))
    expect(filled.find((s) => s.id === 'key-personnel').filled).toBe(true)
  })
})

describe('outlineDropdownOptions', () => {
  it('never includes the compliance matrix itself', () => {
    const outline = buildOutline(baseData({ complianceRows: [{ id: '1' }], winThemes: 'x' }))
    const options = outlineDropdownOptions(outline)
    expect(options.some((o) => o.id === 'compliance-matrix')).toBe(false)
  })

  it('excludes unfilled sections and subsections entirely', () => {
    const outline = buildOutline(baseData())
    const options = outlineDropdownOptions(outline)
    expect(options).toEqual([])
  })

  it('includes only the filled subsection, not its unfilled siblings', () => {
    const outline = buildOutline(baseData({ methodology: 'We will begin performance by...' }))
    const options = outlineDropdownOptions(outline)
    const labels = options.map((o) => o.label)
    expect(labels).toContain('2.1 Proposed Methodology')
    expect(labels).not.toContain('2.2 Quality Control Plan')
  })
})

describe('fully optional sections — absent when blank, numbered when filled', () => {
  it('Delivery Schedule, Warranty, and Reps & Certs are absent from the outline entirely when blank', () => {
    const outline = buildOutline(baseData())
    expect(outline.some((s) => s.id === 'delivery-schedule')).toBe(false)
    expect(outline.some((s) => s.id === 'warranty')).toBe(false)
    expect(outline.some((s) => s.id === 'reps-certs')).toBe(false)
  })

  it('Delivery Schedule appears and is numbered right after Price Proposal when a row has content', () => {
    const outline = buildOutline(baseData({ deliverySchedule: [{ clin: '0001', destination: '' }] }))
    const price = outline.find((s) => s.id === 'price-proposal')
    const delivery = outline.find((s) => s.id === 'delivery-schedule')
    expect(delivery).toBeTruthy()
    expect(Number(delivery.number)).toBe(Number(price.number) + 1)
  })

  it('Warranty appears only when period or terms has content', () => {
    expect(buildOutline(baseData({ warrantyPeriod: '12 months' })).some((s) => s.id === 'warranty')).toBe(true)
    expect(buildOutline(baseData({ warrantyTerms: 'Full replacement.' })).some((s) => s.id === 'warranty')).toBe(true)
    expect(buildOutline(baseData()).some((s) => s.id === 'warranty')).toBe(false)
  })

  it('Reps & Certs appears when SAM is checked, even with nothing else filled', () => {
    expect(buildOutline(baseData({ samRegistrationActive: true })).some((s) => s.id === 'reps-certs')).toBe(true)
  })

  it('Reps & Certs appears when at least one set-aside category is checked', () => {
    expect(buildOutline(baseData({ setAsideCategories: ['SDVOSB'] })).some((s) => s.id === 'reps-certs')).toBe(true)
  })

  it('numbering stays sequential with all three optional sections present', () => {
    const outline = buildOutline(baseData({
      deliverySchedule: [{ clin: '0001', destination: 'x' }],
      warrantyPeriod: '12 months',
      samRegistrationActive: true,
    }))
    const numbers = outline.map((s) => Number(s.number))
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBe(numbers[i - 1] + 1)
    }
  })
})

describe('Assumptions subsection of Price Proposal', () => {
  it('absent when blank', () => {
    const price = buildOutline(baseData()).find((s) => s.id === 'price-proposal')
    expect(price.subsections.some((s) => s.id === 'price-assumptions')).toBe(false)
  })

  it('numbered after Basis of Estimate when both are present', () => {
    const price = buildOutline(baseData({ basisOfEstimate: 'x', assumptions: 'One delivery location.' })).find((s) => s.id === 'price-proposal')
    const boe = price.subsections.find((s) => s.id === 'price-boe')
    const assumptions = price.subsections.find((s) => s.id === 'price-assumptions')
    expect(boe.number).toBe(`${price.number}.1`)
    expect(assumptions.number).toBe(`${price.number}.2`)
  })

  it('numbered .1 on its own when Basis of Estimate is blank but Assumptions is filled', () => {
    const price = buildOutline(baseData({ assumptions: 'One delivery location.' })).find((s) => s.id === 'price-proposal')
    const assumptions = price.subsections.find((s) => s.id === 'price-assumptions')
    expect(assumptions.number).toBe(`${price.number}.1`)
  })
})

describe('flattenOutlineIds / findOutlineLabel', () => {
  it('flattens in render order including subsections', () => {
    const outline = buildOutline(baseData({ methodology: 'x' }))
    const ids = flattenOutlineIds(outline)
    const techIdx = ids.indexOf('technical-approach')
    const subIdx = ids.indexOf('tech-methodology')
    expect(subIdx).toBeGreaterThan(techIdx)
  })

  it('finds the current label for a given id after renumbering', () => {
    const outline = buildOutline(baseData({ complianceRows: [{ id: '1' }] }))
    expect(findOutlineLabel(outline, 'key-personnel')).toBe('4. Key Personnel')
  })
})
