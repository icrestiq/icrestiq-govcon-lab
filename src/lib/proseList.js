// src/lib/proseList.js
//
// The Quality Control Plan and Risk Management fields used to be a single
// free-text field, split on line breaks and rendered entirely as bullets.
// That conflated prose and list items: a lead-in sentence ending in a
// colon became bullet #1, and a section written as full paragraphs (no
// real short items at all) printed as a list of paragraph-length
// "bullets." This module migrates that old shape into three separate,
// individually optional fields — intro (prose), items (short bullets),
// closing (prose) — so the print output can render intro/closing as
// paragraphs and only real items as a list.
//
// Classification rule, applied per line after splitting on line breaks:
//   - a line ending in ":" is prose (it introduces a list, it isn't itself
//     a list item)
//   - a line longer than ~200 characters is prose (a real bullet is
//     short; a full paragraph typed on one line is not)
//   - everything else is treated as a list item
//
// Lines are bucketed conservatively: prose at the very start becomes the
// intro, prose at the very end becomes the closing, everything else that
// classifies as an item in between becomes a bullet. Once trailing prose
// starts, later lines stay classified as trailing prose even if they'd
// individually look like short items — this avoids flip-flopping back
// into "items" mode for something like a short closing remark.

const MAX_ITEM_LENGTH = 200;

function classifyLine(line) {
  if (line.trim().endsWith(':')) return 'prose';
  if (line.length > MAX_ITEM_LENGTH) return 'prose';
  return 'item';
}

/** Converts a legacy free-text block into { intro, items, closing }. */
export function migrateProseList(rawText) {
  if (!rawText || !String(rawText).trim()) return { intro: '', items: [], closing: '' };

  const lines = String(rawText).split('\n').map((s) => s.trim()).filter(Boolean);

  const introLines = [];
  const items = [];
  const closingLines = [];
  let phase = 'intro'; // intro -> items -> closing

  for (const line of lines) {
    const kind = classifyLine(line);
    if (phase === 'intro') {
      if (kind === 'prose') introLines.push(line);
      else { phase = 'items'; items.push(line); }
    } else if (phase === 'items') {
      if (kind === 'item') items.push(line);
      else { phase = 'closing'; closingLines.push(line); }
    } else {
      closingLines.push(line);
    }
  }

  return { intro: introLines.join(' '), items, closing: closingLines.join(' ') };
}

/** True if a value is still the OLD shape (a plain string) rather than the
 *  new { intro, items, closing } object — used to detect drafts that need
 *  migrating when loaded. */
export function isLegacyProseListValue(value) {
  return typeof value === 'string';
}

/** True if a { intro, items, closing } value has any real content —
 *  used by the outline builder to decide whether this section/subsection
 *  is "filled in" for the dropdown and numbering. */
export function proseListHasContent(value) {
  if (!value || typeof value !== 'object') return false;
  const hasIntro = typeof value.intro === 'string' && value.intro.trim().length > 0;
  const hasClosing = typeof value.closing === 'string' && value.closing.trim().length > 0;
  const hasItems = Array.isArray(value.items) && value.items.some((i) => typeof i === 'string' && i.trim().length > 0);
  return hasIntro || hasClosing || hasItems;
}
