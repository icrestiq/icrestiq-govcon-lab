// src/lib/renderProposalHtml.js
//
// Builds the full print HTML document used by the server-side PDF export
// (api/proposal/pdf.js). This is a plain-string mirror of the ProposalPreview
// component in src/pages/ProposalBuilder.jsx — same CSS, same section order,
// same pagination rules — kept as a parallel implementation (not a shared
// React render) so the PDF function doesn't need to bundle React/JSX. This
// is the same tradeoff generateDocx.js already made for the Word export: a
// second hand-written renderer, kept honest by reusing the same content
// helpers (buildOutline, pricing, naics) so numbers and section numbering
// can't drift, even if markup has to be duplicated.
//
// TOC / Compliance Matrix page numbers work in two passes, driven by the
// caller (api/proposal/pdf.js):
//   Pass 1: render with pageNumbers = null. Real content, but the TOC and
//   Compliance Matrix show no page column. Each section/subsection heading
//   carries an invisible marker span with a unique token. The caller
//   renders this to a real PDF with Puppeteer, then scans the actual
//   per-page text (via pdfjs) for each token to learn which page Chromium's
//   own print layout put it on — a fact read back from the finished PDF,
//   not a prediction made ahead of time.
//   Pass 2: render again with pageNumbers populated from that scan. Same
//   HTML structure (markers stay in, so nothing shifts height between
//   passes), now with real numbers in the TOC and Matrix. This second
//   render is the one actually delivered to the user.

import { computeExtended, formatCurrency } from "./pricing";
import { getNaicsTitle } from "./naics";
import { buildOutline, findOutlineLabel } from "./outline";

const NAVY = "#1F3864";
const GOLD = "#B08D57";
const PAPER = "#FDFCFA";

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function nl2br(v) {
  return esc(v).split("\n").join("<br />");
}

// Invisible per-heading marker, read back out of the rendered PDF's text
// layer in pass 1. Chromium's print-to-PDF renderer silently drops any
// text run painted with color:transparent (and visibility:hidden) before
// it ever reaches the PDF's text layer — confirmed by testing — so this
// can't use the usual "transparent + tiny font" trick. color:white at a
// near-zero font size does survive into the text layer (it's still a real
// glyph paint operation, just white-on-white and effectively unreadable
// at 1px), so that's what's used here instead.
function marker(id) {
  return `<span data-pagemarker="${esc(id)}" style="font-size:1px;line-height:0;color:#ffffff;">\u00abPMARK:${esc(id)}\u00bb</span>`;
}

function pageRef(pageNumbers, id) {
  if (!pageNumbers) return "";
  const n = pageNumbers[id];
  return n ? ` <span style="color:#8A94A6;">(p. ${n})</span>` : "";
}

export function renderProposalHtml(data, logoUrl, totalPrice, opts = {}) {
  const pageNumbers = opts.pageNumbers || null;

  const winThemeList = (data.winThemes || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const naicsEntries = (data.naicsCodes || []).map((code) => ({ code, title: getNaicsTitle(code) }));
  const hasMatrix = Array.isArray(data.complianceRows) && data.complianceRows.length > 0;
  const outline = buildOutline(data);
  const numberOf = (id) => {
    for (const sec of outline) {
      if (sec.id === id) return sec.number;
      for (const sub of sec.subsections) if (sub.id === id) return sub.number;
    }
    return "";
  };
  const hasDeliverySchedule = outline.some((s) => s.id === "delivery-schedule");
  const hasWarranty = outline.some((s) => s.id === "warranty");
  const hasRepsCerts = outline.some((s) => s.id === "reps-certs");

  const sep = (content) => `${esc(content)}&nbsp;`;

  // ── Letterhead ──
  const letterhead = `
    <div class="doc-letterhead" style="text-align:center;margin-bottom:32px;">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Company logo" style="max-height:80px;max-width:240px;object-fit:contain;margin-bottom:12px;" />` : ""}
      <div style="font-weight:bold;font-size:22px;color:${NAVY};font-family:'Space Grotesk',sans-serif;">${esc(data.companyName || "[Company Name]")}</div>
      <div style="font-size:12px;color:#666;">
        ${esc(data.companyAddress)} ${data.uei ? `| UEI: ${esc(data.uei)}` : ""} ${data.cageCode ? `| CAGE: ${esc(data.cageCode)}` : ""}
      </div>
      <div style="border-top:2px solid ${GOLD};border-bottom:2px solid ${GOLD};margin:16px 0;padding:10px 0;">
        <div style="font-size:26px;font-weight:bold;color:${NAVY};font-family:'Space Grotesk',sans-serif;">TECHNICAL &amp; PRICE PROPOSAL</div>
      </div>
      <div>In Response to Solicitation No. ${esc(data.solicitationNumber || "[Number]")}</div>
      <div style="font-style:italic;color:#555;">${esc(data.solicitationTitle)}</div>
    </div>`;

  const miniLetterhead = `
    <div style="text-align:center;margin-bottom:24px;">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Company logo" style="max-height:56px;max-width:180px;object-fit:contain;margin-bottom:8px;" />` : ""}
      <div style="font-weight:bold;font-size:18px;color:${NAVY};font-family:'Space Grotesk',sans-serif;">${esc(data.companyName || "[Company Name]")}</div>
      <div style="font-size:11px;color:#666;">
        ${esc(data.companyAddress)} ${data.uei ? `| UEI: ${esc(data.uei)}` : ""} ${data.cageCode ? `| CAGE: ${esc(data.cageCode)}` : ""}
      </div>
      <div style="border-bottom:2px solid ${GOLD};margin:12px 0 0 0;"></div>
    </div>`;

  // ── Cover Letter ──
  const coverLetter = `
    ${miniLetterhead}
    <h2 style="border-bottom:none;">${marker("cover-letter")}Cover Letter</h2>
    <p>${esc(data.submissionDate)}</p>
    <p>${esc(data.contractingOfficer)}<br />${esc(data.agencyName)}<br />${esc(data.agencyAddress)}</p>
    <p>
      Subject: Proposal Submission for ${esc(data.solicitationTitle)}<br />
      <strong>Solicitation No. ${esc(data.solicitationNumber || "[Number]")}</strong>
      ${data.solicitationDueDate ? `<br />Response Due: ${esc(data.solicitationDueDate)}` : ""}
    </p>
    <p>Dear ${esc(data.contractingOfficer || "Contracting Officer")},</p>
    <p>${esc(data.companyName)} is pleased to submit the enclosed proposal in response to the above-referenced solicitation. We have reviewed the solicitation in its entirety and our proposal is fully compliant with the stated requirements, terms, and conditions.</p>
    ${data.noExceptions
      ? `<p>We take no exception to the terms, conditions, and provisions of the solicitation.</p>`
      : (data.exceptionsText && data.exceptionsText.trim()
        ? `<h3>Exceptions</h3><p>${esc(data.exceptionsText.trim())}</p>`
        : "")}
    <p class="cover-signoff">Sincerely,</p>
    <div>
      <div style="height:0.6in;"></div>
      <div class="signature-rule"></div>
      <p class="cover-signature">${esc(data.poc)}<br />${esc(data.pocTitle)}<br />${esc(data.phone)} | ${esc(data.email)}</p>
    </div>
    <p class="enclosures-line">Enclosures: ${esc(outline.map((s) => `${s.number}. ${s.title}`).join("; "))}</p>`;

  // ── Table of Contents ──
  // Deliberately no marker() calls in here — this is the TOC listing
  // itself, not the heading being referenced. A marker here would just
  // find its own line on the TOC's own page, before the real heading
  // later in the document. Markers live only at the actual section/
  // subsection headings below.
  const toc = `
    <h2 style="border-bottom:none;">Table of Contents</h2>
    <table>
      <tbody>
        ${outline.map((sec) => `
          <tr><td style="font-weight:bold;">${esc(sec.number)}. ${esc(sec.title)}${pageRef(pageNumbers, sec.id)}</td></tr>
          ${sec.subsections.map((sub) => `
            <tr><td style="padding-left:24px;">${esc(sub.number)} ${esc(sub.title)}${pageRef(pageNumbers, sub.id)}</td></tr>
          `).join("")}
        `).join("")}
      </tbody>
    </table>`;

  // ── Compliance Matrix ──
  const complianceMatrix = hasMatrix ? `
    <h2 style="border-bottom:none;">${marker("compliance-matrix")}${numberOf("compliance-matrix")}. Compliance Cross-Reference Matrix</h2>
    <table>
      <thead><tr><th>Solicitation Ref.</th><th>Requirement</th><th>Proposal Section</th></tr></thead>
      <tbody>
        ${data.complianceRows.map((row) => {
          const label = row.sectionId ? findOutlineLabel(outline, row.sectionId) : null;
          return `<tr><td>${esc(row.solicitationRef)}</td><td>${esc(row.requirement)}</td><td>${label ? esc(label) + pageRef(pageNumbers, row.sectionId) : "\u2014"}</td></tr>`;
        }).join("")}
      </tbody>
    </table>` : "";

  // ── Executive Summary ──
  const executiveSummary = `
    <h2>${marker("executive-summary")}${numberOf("executive-summary")}. Executive Summary</h2>
    <h3>${marker("exec-requirement")}${numberOf("exec-requirement")} Understanding of the Requirement</h3>
    <p>${esc(data.requirementSummary)}</p>
    <h3>${marker("exec-winthemes")}${numberOf("exec-winthemes")} Win Themes</h3>
    <ul>${winThemeList.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <h3>${marker("exec-snapshot")}${numberOf("exec-snapshot")} Company Snapshot</h3>
    <p>${esc(data.companySnapshot)}</p>
    <p><strong>Business Size:</strong> ${esc(data.businessSize)}</p>
    <p style="margin-bottom:0;"><strong>NAICS:</strong></p>
    ${naicsEntries.length > 0 ? `<ul>${naicsEntries.map(({ code, title }) => `<li>${esc(code)} \u2013 ${esc(title)}</li>`).join("")}</ul>` : ""}
    ${data.unverifiedNaicsEntries && data.unverifiedNaicsEntries.length > 0
      ? `<p style="font-size:11px;color:#888;font-style:italic;">(${data.unverifiedNaicsEntries.length} unverified NAICS ${data.unverifiedNaicsEntries.length === 1 ? "entry" : "entries"} not shown \u2014 reselect in the builder before submitting.)</p>`
      : ""}`;

  function renderProseList(value) {
    const items = Array.isArray(value?.items) ? value.items.map((s) => s.trim()).filter(Boolean) : [];
    return `
      ${value?.intro?.trim() ? `<p>${esc(value.intro.trim())}</p>` : ""}
      ${items.length ? `<ul>${items.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}
      ${value?.closing?.trim() ? `<p>${esc(value.closing.trim())}</p>` : ""}`;
  }

  // ── Technical Approach ──
  const technicalApproach = `
    <h2>${marker("technical-approach")}${numberOf("technical-approach")}. Technical Approach</h2>
    <h3>${marker("tech-methodology")}${numberOf("tech-methodology")} Proposed Methodology</h3>
    <p>${esc(data.methodology)}</p>
    <h3>${marker("tech-qc")}${numberOf("tech-qc")} Quality Control Plan</h3>
    ${renderProseList(data.qualityControl)}
    <h3>${marker("tech-risk")}${numberOf("tech-risk")} Risk Management</h3>
    ${renderProseList(data.riskManagement)}`;

  // ── Key Personnel ──
  const keyPersonnel = `
    <h2>${marker("key-personnel")}${numberOf("key-personnel")}. Key Personnel</h2>
    <table class="personnel-table">
      <colgroup><col class="col-name" /><col class="col-role" /><col class="col-exp" /><col class="col-alloc" /></colgroup>
      <thead><tr><th>Name</th><th>Role</th><th>Experience</th><th>% Allocation</th></tr></thead>
      <tbody>
        ${data.personnel.map((p) => `<tr class="personnel-row"><td>${esc(p.name)}</td><td>${esc(p.role)}</td><td>${esc(p.experience)}</td><td>${esc(p.allocation)}</td></tr>`).join("")}
      </tbody>
    </table>`;

  // ── Past Performance ──
  const pastPerformance = data.pastPerformance.map((pp, i) => {
    const rows = [
      ["Contract #", pp.contractNumber, "width:30%;"], ["Agency", pp.agency], ["Period", pp.period],
      ["Value", pp.value], ["Scope", pp.scope], ["Relevance to This Requirement", pp.relevance],
      ...(pp.contractType ? [["Contract Type", pp.contractType]] : []),
      ...(pp.primeOrSub ? [["Role", pp.primeOrSub]] : []),
      ["Reference", pp.reference], ["Reference Email", pp.referenceEmail],
      ...(pp.cpars ? [["CPARS Rating", pp.cpars]] : []),
    ];
    const table = `
      <div class="pastperf-block" style="margin-bottom:14px;">
        <table><tbody>
          ${rows.map(([label, value, w]) => `<tr><td style="font-weight:bold;${w || ""}">${esc(label)}</td><td>${esc(value)}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
    return i === 0
      ? `<div style="break-inside:avoid;page-break-inside:avoid;"><h2>${marker("past-performance")}${numberOf("past-performance")}. Past Performance</h2>${table}</div>`
      : table;
  }).join("");

  // ── Price Proposal ──
  const priceProposal = `
    <h2>${marker("price-proposal")}${numberOf("price-proposal")}. Price Proposal</h2>
    <table>
      <thead><tr><th>CLIN</th><th>Description</th><th>Quantity</th><th>Unit</th><th>Unit Price</th><th>Ext. Price</th></tr></thead>
      <tbody>
        ${data.pricing.map((row) => `
          <tr>
            <td>${sep(row.clin)}</td><td>${sep(row.description)}</td><td>${sep(row.quantity)}</td>
            <td>${sep(row.unitOfMeasure)}</td><td>${sep(formatCurrency(row.unitPrice))}</td>
            <td>${esc(formatCurrency(computeExtended(row.quantity, row.unitPrice)))}</td>
          </tr>`).join("")}
        <tr><td colspan="5" style="font-weight:bold;text-align:right;">Total Evaluated Price</td><td style="font-weight:bold;">${esc(formatCurrency(totalPrice))}</td></tr>
      </tbody>
    </table>
    ${data.fobTerm ? `<p><strong>${esc(data.fobTerm)}</strong></p>` : ""}
    ${numberOf("price-boe") ? `<h3>${marker("price-boe")}${numberOf("price-boe")} Basis of Estimate</h3><p>${esc(data.basisOfEstimate)}</p>` : ""}
    ${numberOf("price-assumptions") ? `<h3>${marker("price-assumptions")}${numberOf("price-assumptions")} Assumptions</h3><ul>${(data.assumptions || "").split("\n").map((s) => s.trim()).filter(Boolean).map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}`;

  // ── Optional trailing sections ──
  const deliverySchedule = hasDeliverySchedule ? `
    <h2>${marker("delivery-schedule")}${numberOf("delivery-schedule")}. Delivery Schedule</h2>
    <table>
      <thead><tr><th>CLIN</th><th>Destination</th><th>Quantity</th><th>Delivery</th></tr></thead>
      <tbody>
        ${data.deliverySchedule.map((row) => `
          <tr><td>${esc(row.clin)}</td><td>${esc(row.destination)}</td><td>${esc(row.quantity)}</td>
          <td>${row.daysAfterReceipt ? esc(`${row.daysAfterReceipt} days after receipt of order`) : esc(row.deliveryDate || "")}</td></tr>`).join("")}
      </tbody>
    </table>` : "";

  const warranty = hasWarranty ? `
    <h2>${marker("warranty")}${numberOf("warranty")}. Warranty</h2>
    ${data.warrantyPeriod ? `<p><strong>Warranty Period:</strong> ${esc(data.warrantyPeriod)}</p>` : ""}
    ${data.warrantyTerms ? `<p>${esc(data.warrantyTerms)}</p>` : ""}` : "";

  const repsCerts = hasRepsCerts ? `
    <h2>${marker("reps-certs")}${numberOf("reps-certs")}. Representations and Certifications</h2>
    <ul>
      ${data.samRegistrationActive ? `<li>SAM registration: Active${data.uei ? ` (UEI: ${esc(data.uei)})` : ""}${data.samExpirationDate ? `, expires ${esc(data.samExpirationDate)}` : ""}</li>` : ""}
      ${data.businessSize && data.businessSize.trim() ? `<li>Business size: ${esc(data.businessSize.trim())}</li>` : ""}
      ${(data.setAsideCategories || []).map((cat) => `<li>Socioeconomic set-aside claimed: ${esc(cat)}</li>`).join("")}
    </ul>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, serif; color: #222; line-height: 1.5; background: #fff; }
  .doc-page h2, .doc-page h3 { font-family: 'Space Grotesk', sans-serif; }
  .doc-page h2 { color: ${NAVY}; border-bottom: 2px solid ${NAVY}; padding-bottom: 6px; font-size: 18px; margin-top: 0; page-break-after: avoid; break-after: avoid; }
  .doc-page h3 { color: ${NAVY}; font-size: 15px; margin-bottom: 4px; page-break-after: avoid; break-after: avoid; }
  .doc-section-break { page-break-before: always; break-before: page; }
  .doc-page table thead { display: table-header-group; }
  .doc-page table tr { page-break-inside: avoid; break-inside: avoid; }
  .personnel-row, .pastperf-block { page-break-inside: avoid; break-inside: avoid; }
  .doc-page p, .doc-page li { orphans: 3; widows: 3; }
  .doc-page table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .doc-page th { background: ${NAVY}; color: #fff; text-align: left; padding: 6px 8px; font-size: 12px; }
  .doc-page td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
  .doc-page tr:nth-child(even) td { background: #f7f7f5; }
  .doc-page p { margin: 0 0 12pt 0; }
  .doc-page ul { margin: 0 0 12pt 0; padding-left: 20px; }
  .doc-page li { margin-bottom: 4pt; }
  .cover-signoff { margin-bottom: 4pt !important; }
  .cover-signature { margin-top: 4pt !important; line-height: 1.4; }
  .signature-rule { border-top: 1px solid #333; width: 3in; margin-top: 2pt; }
  .enclosures-line { margin-top: 8pt; font-size: 0.9em; }
  .cover-letter-section p { margin-bottom: 8pt; }
  .personnel-table col.col-name { width: 22%; }
  .personnel-table col.col-role { width: 24%; }
  .personnel-table col.col-exp  { width: 42%; }
  .personnel-table col.col-alloc { width: 12%; }
  .doc-letterhead {
    /* 8.3in, not the original design's 9in: testing against this exact
       margin/header-footer configuration (top:1in, bottom:0.85in, plus
       Puppeteer's own header/footer template reservation) showed the
       usable content height is closer to ~8.7-8.8in in practice, not the
       naive 11 - 1.85 = 9.15in the margin numbers alone suggest — likely
       extra space Chromium reserves for the header/footer templates
       beyond the stated margin. 9in min-height was overflowing onto a
       second, nearly blank page as a result. 8.3in leaves real headroom
       under the measured threshold rather than sitting right on it. */
    min-height: 8.3in;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
</style>
</head>
<body>
  <div class="doc-page">
    <div class="doc-letterhead">${letterhead}</div>
    <div class="doc-section doc-section-break cover-letter-section">${coverLetter}</div>
    <div class="doc-section doc-section-break">${toc}</div>
    ${hasMatrix ? `<div class="doc-section doc-section-break">${complianceMatrix}</div>` : ""}
    <div class="doc-section">${executiveSummary}</div>
    <div class="doc-section">${technicalApproach}</div>
    <div class="doc-section">${keyPersonnel}</div>
    <div class="doc-section">${pastPerformance}</div>
    <div class="doc-section doc-section-break">${priceProposal}</div>
    ${hasDeliverySchedule ? `<div class="doc-section">${deliverySchedule}</div>` : ""}
    ${hasWarranty ? `<div class="doc-section">${warranty}</div>` : ""}
    ${hasRepsCerts ? `<div class="doc-section">${repsCerts}</div>` : ""}
  </div>
</body>
</html>`;
}