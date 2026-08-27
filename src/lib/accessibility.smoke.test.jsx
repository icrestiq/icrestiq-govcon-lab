// @vitest-environment jsdom
//
// Automated accessibility smoke test (axe-core), added as part of the
// WCAG 2.2 AA pass. This runs a handful of real, self-contained
// components (ones that don't need Supabase/Auth context to render)
// through axe-core inside jsdom, to catch ARIA/label/role regressions in
// CI going forward.
//
// What this does NOT cover: full-page rendering (most pages need live
// Supabase/Auth/Router context this harness doesn't provide), real
// browser layout, color-contrast (jsdom has no paint/layout engine, so
// axe's contrast checks are unreliable here and are disabled below —
// contrast was verified manually against the actual design tokens
// instead), keyboard interaction, or screen-reader behavior. It is a
// narrow, useful signal, not a substitute for the manual/live-browser
// testing a full audit requires.
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'
import Footer from '../components/layout/Footer'
import EmojiPicker from '../components/EmojiPicker'
import TagInput from '../components/TagInput'

async function runAxe(element) {
  // Wrapped in <main> to match how these components actually render in
  // the app (inside Layout.jsx's <main>) — testing them bare would trip
  // axe's landmark-region check as a false positive of this harness, not
  // a real issue with the component.
  const html = renderToStaticMarkup(<main>{element}</main>)
  document.body.innerHTML = html
  const results = await axe.run(document.body, {
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations
}

describe('accessibility smoke test (axe-core)', () => {
  it('Footer has no axe violations', async () => {
    const violations = await runAxe(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    )
    expect(violations).toEqual([])
  })

  it('EmojiPicker trigger has no axe violations', async () => {
    const violations = await runAxe(
      <EmojiPicker trigger={<span>😀</span>} label="Insert emoji" onSelect={() => {}} />
    )
    expect(violations).toEqual([])
  })

  it('TagInput has no axe violations when given a label', async () => {
    const violations = await runAxe(
      <>
        <label htmlFor="test-tags">Test tags</label>
        <TagInput id="test-tags" value={['one', 'two']} onChange={() => {}} placeholder="Add a tag" />
      </>
    )
    expect(violations).toEqual([])
  })
})
