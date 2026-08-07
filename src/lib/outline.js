// src/lib/outline.js
//
// Builds the numbered outline of the proposal body. Used in three places:
// the numbered section headings in the printed document, the Table of
// Contents, and the "Proposal section" dropdown in the Compliance Matrix
// row editor.
//
// Numbering rule: the Cover Letter is unnumbered front matter, like the
// letterhead. The Compliance Cross-Reference Matrix, when the user has
// added at least one row, becomes section 1; everything after it shifts
// down by one. With no matrix rows, numbering starts at Executive Summary
// = 1, exactly as it always has.
//
// The printed document always renders all six body sections regardless of
// how much content is in them (existing behavior, unchanged here) — this
// module doesn't hide anything from the printed output. What it DOES
// filter is the dropdown: only sections/subsections with real user content
// are offered as a compliance-row reference, per "populated from the
// sections the user has actually filled in."

import { proseListHasContent } from './proseList';

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function buildOutline(data) {
  const hasMatrix = Array.isArray(data.complianceRows) && data.complianceRows.length > 0;
  const sections = [];
  let n = 1;

  if (hasMatrix) {
    sections.push({
      id: 'compliance-matrix',
      number: String(n),
      title: 'Compliance Cross-Reference Matrix',
      filled: true,
      subsections: [],
    });
    n++;
  }

  {
    const subs = [
      { id: 'exec-requirement', title: 'Understanding of the Requirement', filled: hasText(data.requirementSummary) },
      { id: 'exec-winthemes', title: 'Win Themes', filled: hasText(data.winThemes) },
      { id: 'exec-snapshot', title: 'Company Snapshot', filled: hasText(data.companySnapshot) },
    ];
    let sn = 1;
    for (const s of subs) s.number = `${n}.${sn++}`;
    sections.push({
      id: 'executive-summary', number: String(n), title: 'Executive Summary',
      filled: subs.some((s) => s.filled), subsections: subs,
    });
    n++;
  }

  {
    const subs = [
      { id: 'tech-methodology', title: 'Proposed Methodology', filled: hasText(data.methodology) },
      { id: 'tech-qc', title: 'Quality Control Plan', filled: proseListHasContent(data.qualityControl) },
      { id: 'tech-risk', title: 'Risk Management', filled: proseListHasContent(data.riskManagement) },
    ];
    let sn = 1;
    for (const s of subs) s.number = `${n}.${sn++}`;
    sections.push({
      id: 'technical-approach', number: String(n), title: 'Technical Approach',
      filled: subs.some((s) => s.filled), subsections: subs,
    });
    n++;
  }

  {
    const filled = Array.isArray(data.personnel) && data.personnel.some((p) => hasText(p.name));
    sections.push({ id: 'key-personnel', number: String(n), title: 'Key Personnel', filled, subsections: [] });
    n++;
  }

  {
    const filled = Array.isArray(data.pastPerformance) && data.pastPerformance.some((p) => hasText(p.contractNumber));
    sections.push({ id: 'past-performance', number: String(n), title: 'Past Performance', filled, subsections: [] });
    n++;
  }

  {
    const pricingFilled = Array.isArray(data.pricing) && data.pricing.some((r) => hasText(r.clin) || hasText(r.description));
    const boeFilled = hasText(data.basisOfEstimate);
    const assumptionsFilled = hasText(data.assumptions);
    const subs = [];
    let sn = 1;
    if (boeFilled) subs.push({ id: 'price-boe', number: `${n}.${sn++}`, title: 'Basis of Estimate', filled: true });
    if (assumptionsFilled) subs.push({ id: 'price-assumptions', number: `${n}.${sn++}`, title: 'Assumptions', filled: true });
    sections.push({
      id: 'price-proposal', number: String(n), title: 'Price Proposal',
      filled: pricingFilled || boeFilled || assumptionsFilled, subsections: subs,
    });
    n++;
  }

  // These three are true optional sections: entirely absent from numbering,
  // the TOC, and the printed body when the user hasn't put anything in
  // them — not just hidden-but-numbered like the six core sections above.
  {
    const filled = Array.isArray(data.deliverySchedule) && data.deliverySchedule.some((r) => hasText(r.clin) || hasText(r.destination));
    if (filled) {
      sections.push({ id: 'delivery-schedule', number: String(n), title: 'Delivery Schedule', filled: true, subsections: [] });
      n++;
    }
  }

  {
    const filled = hasText(data.warrantyPeriod) || hasText(data.warrantyTerms);
    if (filled) {
      sections.push({ id: 'warranty', number: String(n), title: 'Warranty', filled: true, subsections: [] });
      n++;
    }
  }

  {
    const hasSamRep = !!data.samRegistrationActive;
    const hasBizSize = hasText(data.businessSize);
    const hasSetAsides = Array.isArray(data.setAsideCategories) && data.setAsideCategories.length > 0;
    const filled = hasSamRep || hasBizSize || hasSetAsides;
    if (filled) {
      sections.push({ id: 'reps-certs', number: String(n), title: 'Representations and Certifications', filled: true, subsections: [] });
      n++;
    }
  }

  return sections;
}

/** Flattened {id, label} list for the compliance row "Proposal section"
 *  dropdown — top-level sections and subsections that actually have user
 *  content, skipping the matrix itself (a row can't reference the matrix
 *  it lives in). Cover Letter is prepended unconditionally: it's
 *  unnumbered front matter (see the note at the top of this file) so it
 *  never appears in `outline` itself, but it's a fixed part of every
 *  proposal — always rendered — so it's always offered here, unlike the
 *  numbered sections below it which only appear once the user has put
 *  something in them. */
export function outlineDropdownOptions(outline) {
  const options = [{ id: 'cover-letter', label: 'Cover Letter' }];
  for (const sec of outline) {
    if (sec.id === 'compliance-matrix') continue;
    if (sec.filled) options.push({ id: sec.id, label: `${sec.number}. ${sec.title}` });
    for (const sub of sec.subsections) {
      if (sub.filled) options.push({ id: sub.id, label: `${sub.number} ${sub.title}` });
    }
  }
  return options;
}

/** Every section id in the exact order they're rendered, including
 *  subsection ids — this is what the page-measurement pass walks to build
 *  the id -> page number map. */
export function flattenOutlineIds(outline) {
  const ids = [];
  for (const sec of outline) {
    ids.push(sec.id);
    for (const sub of sec.subsections) ids.push(sub.id);
  }
  return ids;
}

export function findOutlineLabel(outline, id) {
  if (id === 'cover-letter') return 'Cover Letter';
  for (const sec of outline) {
    if (sec.id === id) return `${sec.number}. ${sec.title}`;
    for (const sub of sec.subsections) {
      if (sub.id === id) return `${sub.number} ${sub.title}`;
    }
  }
  return null;
}