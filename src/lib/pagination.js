// src/lib/pagination.js
//
// Client-side, best-effort page-number resolution for the printed
// proposal. Browsers give JavaScript no API to ask "what page will this
// land on" — pagination only happens inside the opaque native print
// engine, which this code can't see into. This works around that by
// measuring the ACTUAL rendered height of each top-level block (in the
// same fonts, at the same content width the @page rule uses) and
// simulating the pagination rules this document actually uses:
//
//   - A handful of sections (Cover Letter, Table of Contents, Compliance
//     Matrix, Price Proposal) force a fresh page — page-break-before.
//   - Everything else flows continuously: it starts wherever the
//     previous content left off, unless it doesn't fit the remaining
//     space on the current page, in which case it starts fresh (headings
//     use break-after: avoid, so a heading is never left stranded at the
//     bottom of a page — a section that doesn't fit moves as a whole).
//
// What this can't fully replicate from heights alone: exactly how
// break-inside: avoid moves an individual table row or block once a
// section is already flowing, and orphans/widows within a paragraph.
// Those can occasionally shift a real print's page boundaries by one
// page right at a boundary. Where the simulation lands suspiciously close
// to a boundary — either "does this fit in the remaining space" or "does
// this block's own height cross a page-count line" — it stops resolving
// from that point forward rather than risk a confidently wrong number.
// This was tuned against a real print engine, not just in theory: see
// pagination.test.js and the empirical notes there.

const LETTER_HEIGHT_IN = 11;
const MARGIN_IN = 1;
const PX_PER_IN = 96; // CSS reference pixel — 1in is always 96px regardless of real screen/print DPI
export const PAGE_CONTENT_HEIGHT_PX = (LETTER_HEIGHT_IN - 2 * MARGIN_IN) * PX_PER_IN; // 864px

// How close a measured value is allowed to sit to a page-boundary decision
// (in px) before it's treated as too close to call. Real print engines
// don't necessarily fit exactly PAGE_CONTENT_HEIGHT_PX of content per page
// the way a pure CSS-pixel calculation predicts — verified empirically
// (via a real WebKit print render) that content measuring a few percent
// over a page-boundary multiple in this DOM-measurement pass still fit on
// the earlier page in the actual print output.
const BOUNDARY_TOLERANCE_PX = PAGE_CONTENT_HEIGHT_PX * 0.05;

function isCloseToBoundary(value, boundary) {
  return Math.abs(value - boundary) < BOUNDARY_TOLERANCE_PX;
}

/**
 * blocks: ordered array of { id, heightPx, forceBreak }, measured from the
 * DOM in the exact order those blocks render. forceBreak = true for
 * sections with page-break-before: always (Cover Letter, TOC, Compliance
 * Matrix, Price Proposal); false for sections that flow continuously.
 *
 * Returns Map<id, pageNumber>, 1-indexed — as a confident PREFIX of the
 * list. As soon as one block's placement is too close to a boundary to
 * trust, resolution stops there: render an em dash for that block and
 * everything after it, since a wrong guess about where one block lands
 * changes where every later block starts too.
 *
 * Returns an entirely empty Map if any height is missing/invalid — that
 * indicates the measurement pass itself failed, not just one ambiguous
 * block, so nothing in the batch can be trusted.
 */
export function computePageMap(blocks) {
  const map = new Map();
  if (!Array.isArray(blocks) || blocks.length === 0) return map;

  for (const { heightPx } of blocks) {
    if (!Number.isFinite(heightPx) || heightPx <= 0) return new Map();
  }

  let currentPage = 1;
  let usedOnCurrentPage = 0; // px already consumed on currentPage

  for (const { id, heightPx, forceBreak } of blocks) {
    if (forceBreak) {
      if (usedOnCurrentPage > 0) currentPage += 1;
      usedOnCurrentPage = 0;
    } else if (usedOnCurrentPage > 0) {
      // Flowing block on a page that already has content: does it fit in
      // what's left? If this is a close call, stop rather than guess.
      const remaining = PAGE_CONTENT_HEIGHT_PX - usedOnCurrentPage;
      if (isCloseToBoundary(heightPx, remaining)) return map;
      if (heightPx > remaining) {
        currentPage += 1;
        usedOnCurrentPage = 0;
      }
    }

    // Whether this block's own height lands close to a whole-page-count
    // boundary is also a close call worth stopping on.
    const totalOnThisRun = usedOnCurrentPage + heightPx;
    const pagesFloat = totalOnThisRun / PAGE_CONTENT_HEIGHT_PX;
    const nearestBoundary = Math.round(pagesFloat);
    if (nearestBoundary >= 1 && Math.abs(pagesFloat - nearestBoundary) * PAGE_CONTENT_HEIGHT_PX < BOUNDARY_TOLERANCE_PX) {
      map.set(id, currentPage);
      return map;
    }

    map.set(id, currentPage);
    currentPage += Math.floor(totalOnThisRun / PAGE_CONTENT_HEIGHT_PX);
    usedOnCurrentPage = totalOnThisRun % PAGE_CONTENT_HEIGHT_PX;
  }

  return map;
}
