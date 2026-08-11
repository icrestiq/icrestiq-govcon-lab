// src/lib/generateDocx.js
//
// Generates a Word (.docx) version of the proposal, entirely client-side.
// Mirrors the same section structure, numbering, and content as the print
// preview — reuses the exact same outline/pricing/naics helpers so the
// two output formats can't silently drift apart (e.g. a numbering change
// made to one and forgotten in the other).
//
// The Table of Contents uses Word's own native TOC field (via
// HeadingLevel-tagged paragraphs), so it carries real page numbers —
// computed by Word itself against its own actual pagination, not
// estimated ahead of time the way the PDF preview would have to. The
// field populates the moment Word opens the file (docx sets
// updateFields: true below, which tells Word to refresh all fields on
// open automatically, so no manual "right-click > Update Field" step is
// needed in practice). One real caveat: viewers that don't execute
// Word's field-update logic — LibreOffice headless conversion, Google
// Docs preview, quick-look style previews — will render the field's
// last-cached value, which for a freshly generated document is blank.
// A visible note is added directly under the TOC heading so a reader in
// one of those viewers understands why and knows to open the file in
// Word (or press Ctrl+A then F9) rather than assuming the export is
// broken.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType,
  ImageRun, ShadingType, BorderStyle, Footer, PageNumber, TabStopType, TabStopPosition,
  TableOfContents,
} from "docx";
import { computeExtended, formatCurrency } from "./pricing";
import { getNaicsTitle } from "./naics";
import { buildOutline, findOutlineLabel } from "./outline";

const NAVY_HEX = "1F3864";
const GOLD_HEX = "B08D57";
const MUTED_HEX = "666666";

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn("Could not fetch logo for Word export:", err);
    return null;
  }
}

function heading(text, level, pageBreakBefore = false) {
  return new Paragraph({
    heading: level,
    pageBreakBefore,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, color: NAVY_HEX })],
  });
}

function bodyParagraph(text, spacingAfter = 200) {
  return new Paragraph({
    spacing: { after: spacingAfter },
    children: (text || "").split("\n").flatMap((line, i, arr) =>
      i < arr.length - 1 ? [new TextRun({ text: line }), new TextRun({ break: 1 })] : [new TextRun({ text: line })]
    ),
  });
}

function boldParagraph(text) {
  return new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: text || "", bold: true })] });
}

function bulletParagraph(text) {
  return new Paragraph({ text: text || "", bullet: { level: 0 }, spacing: { after: 80 } });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { fill: NAVY_HEX, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      // keepNext ties this cell's paragraph to whatever immediately
      // follows it — when set on every row but the last in a table, it
      // tells Word "never break a page between these rows," so the whole
      // table moves as one unit instead of splitting. Used below only for
      // keyValueTable (past-performance records): each one is a bounded,
      // single-topic block where a lone trailing row (e.g. just "CPARS
      // Rating: Exceptional") stranded alone on an otherwise-blank page —
      // immediately followed by Price Proposal's own forced page break —
      // reads as broken. table() (Compliance Matrix, Key Personnel,
      // Delivery Schedule, Pricing) deliberately does NOT get this: those
      // routinely run longer than a page, and forcing a big multi-row
      // table to jump wholesale when it doesn't fit is the "large blank
      // gap" failure mode already fixed once before elsewhere in this
      // file — this is a narrow fix for one specific adjacency, not a
      // general "keep tables together" rule.
      keepNext: !!opts.keepNext,
      children: [new TextRun({ text: text == null ? "" : String(text), bold: !!opts.header, color: opts.header ? "FFFFFF" : undefined, size: 20 })],
    })],
  });
}

function table(headerCells, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    },
    rows: [
      new TableRow({ cantSplit: true, children: headerCells.map((h, i) => cell(h, { header: true, width: widths?.[i] })) }),
      ...rows.map((row) => new TableRow({ cantSplit: true, children: row.map((c, i) => cell(c, { width: widths?.[i] })) })),
    ],
  });
}

function keyValueTable(pairs) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    },
    rows: pairs.map(([label, value], i) => new TableRow({
      cantSplit: true,
      children: [
        cell(label, { width: 30, keepNext: i < pairs.length - 1 }),
        cell(value, { width: 70, keepNext: i < pairs.length - 1 }),
      ],
    })),
  });
}

export async function generateProposalDocx(data, logoUrl, totalPrice) {
  const outline = buildOutline(data);
  const hasMatrix = Array.isArray(data.complianceRows) && data.complianceRows.length > 0;
  const numberOf = (id) => {
    for (const sec of outline) {
      if (sec.id === id) return sec.number;
      for (const sub of sec.subsections) if (sub.id === id) return sub.number;
    }
    return "";
  };

  const children = [];

  // ── Letterhead / title page ──
  const logoBuffer = await fetchImageBuffer(logoUrl);
  if (logoBuffer) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new ImageRun({ data: logoBuffer, transformation: { width: 160, height: 70 }, type: "png" })],
    }));
  }
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.companyName || "[Company Name]", bold: true, size: 32, color: NAVY_HEX })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 300 },
      children: [new TextRun({
        text: [data.companyAddress, data.uei && `UEI: ${data.uei}`, data.cageCode && `CAGE: ${data.cageCode}`].filter(Boolean).join(" | "),
        size: 20, color: MUTED_HEX,
      })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "TECHNICAL & PRICE PROPOSAL", bold: true, size: 40, color: NAVY_HEX })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `In Response to Solicitation No. ${data.solicitationNumber || "[Number]"}` })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: data.solicitationTitle || "", italics: true, color: "555555" })] }),
  );

  // ── Cover Letter — unnumbered front matter, own page, same as the PDF ──
  const coverLetterChildren = [];
  if (logoBuffer) {
    // pageBreakBefore goes here, on the actual first element of this
    // page — it was previously on the paragraph after this one, which
    // meant the logo rendered wherever the title page's flow happened to
    // leave off (not on the cover letter page at all) and the break
    // landed the company name on a fresh page without it.
    coverLetterChildren.push(new Paragraph({
      pageBreakBefore: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new ImageRun({ data: logoBuffer, transformation: { width: 160, height: 70 }, type: "png" })],
    }));
  }
  coverLetterChildren.push(
    new Paragraph({ pageBreakBefore: !logoBuffer, alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.companyName || "[Company Name]", bold: true, color: NAVY_HEX, size: 24 })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 300 },
      children: [new TextRun({ text: [data.companyAddress, data.uei && `UEI: ${data.uei}`, data.cageCode && `CAGE: ${data.cageCode}`].filter(Boolean).join(" | "), size: 18, color: MUTED_HEX })],
    }),
    heading("Cover Letter", HeadingLevel.HEADING_1),
    bodyParagraph(data.submissionDate),
    bodyParagraph(`${data.contractingOfficer}\n${data.agencyName}\n${data.agencyAddress}`, 400),
    bodyParagraph(`Subject: Proposal Submission for ${data.solicitationTitle}`, 400),
    new Paragraph({
      spacing: { after: 400 },
      children: [
        new TextRun({ text: "Solicitation No. ", }),
        new TextRun({ text: data.solicitationNumber || "[Number]", bold: true }),
        ...(data.solicitationDueDate ? [new TextRun({ break: 1 }), new TextRun({ text: `Response Due: ${data.solicitationDueDate}` })] : []),
      ],
    }),
    bodyParagraph(`Dear ${data.contractingOfficer || "Contracting Officer"},`),
    bodyParagraph(`${data.companyName} is pleased to submit the enclosed proposal in response to the above-referenced solicitation. We have reviewed the solicitation in its entirety and our proposal is fully compliant with the stated requirements, terms, and conditions.`, 400),
  );
  if (data.noExceptions) {
    coverLetterChildren.push(bodyParagraph("We take no exception to the terms, conditions, and provisions of the solicitation.", 400));
  } else if (data.exceptionsText && data.exceptionsText.trim()) {
    coverLetterChildren.push(heading("Exceptions", HeadingLevel.HEADING_2), bodyParagraph(data.exceptionsText.trim(), 400));
  }
  coverLetterChildren.push(
    // "Sincerely," followed by real blank space (0.6in, matching the PDF)
    // before the signature line — was 20 twips (1pt), essentially none.
    new Paragraph({ spacing: { after: 864 }, children: [new TextRun({ text: "Sincerely," })] }),
    // A real signature line, not a full-page-width rule — narrowed via a
    // right indent so only about 3in of the 6.5in content width carries
    // the border, reading as an actual line to sign on.
    new Paragraph({
      spacing: { after: 20 },
      indent: { right: 5040 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } },
      children: [new TextRun({ text: "\u00A0" })],
    }),
    bodyParagraph(`${data.poc}\n${data.pocTitle}\n${data.phone} | ${data.email}`),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `Enclosures: ${outline.map((s) => `${s.number}. ${s.title}`).join("; ")}`, size: 18 })] }),
  );
  children.push(...coverLetterChildren);

  // ── Table of Contents — a native Word field with real page numbers.
  // Populates from the HeadingLevel-tagged section/subsection paragraphs
  // pushed throughout this document. `updateFields: true` on the Document
  // (below) tells Word to refresh this — and the footer's page fields —
  // the moment the file opens, which is standard behavior for any Word
  // document containing an auto-generated TOC. ──
  children.push(
    new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: NAVY_HEX })] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: "(Page numbers refresh automatically when opened in Word. If viewing in another application, select the table and press F9, or right-click and choose Update Field. Delete this note before printing or submitting the proposal.)",
        bold: true,
        color: "FF0000",
        size: 18,
      })],
    }),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  );

  // ── Compliance Matrix (only when the matrix has rows) ──
  if (hasMatrix) {
    children.push(
      heading(`${numberOf("compliance-matrix")}. Compliance Cross-Reference Matrix`, HeadingLevel.HEADING_1, true),
      table(
        ["Solicitation Ref.", "Requirement", "Proposal Section"],
        data.complianceRows.map((row) => [row.solicitationRef, row.requirement, row.sectionId ? (findOutlineLabel(outline, row.sectionId) || "\u2014") : "\u2014"]),
        [20, 50, 30]
      )
    );
  }

  // ── Executive Summary ──
  children.push(heading(`${numberOf("executive-summary")}. Executive Summary`, HeadingLevel.HEADING_1));
  if (data.requirementSummary) children.push(heading(`${numberOf("exec-requirement")} Understanding of the Requirement`, HeadingLevel.HEADING_2), bodyParagraph(data.requirementSummary));
  const winThemes = (data.winThemes || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (winThemes.length) {
    children.push(heading(`${numberOf("exec-winthemes")} Win Themes`, HeadingLevel.HEADING_2));
    winThemes.forEach((t) => children.push(bulletParagraph(t)));
  }
  if (data.companySnapshot) children.push(heading(`${numberOf("exec-snapshot")} Company Snapshot`, HeadingLevel.HEADING_2), bodyParagraph(data.companySnapshot));
  if (data.businessSize) children.push(boldParagraph(`Business Size: ${data.businessSize}`));
  const naicsEntries = (data.naicsCodes || []).map((code) => ({ code, title: getNaicsTitle(code) }));
  if (naicsEntries.length) {
    children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "NAICS:", bold: true })] }));
    naicsEntries.forEach(({ code, title }) => children.push(bulletParagraph(`${code} \u2013 ${title}`)));
  }

  // ── Technical Approach ──
  children.push(heading(`${numberOf("technical-approach")}. Technical Approach`, HeadingLevel.HEADING_1));
  if (data.methodology) children.push(heading(`${numberOf("tech-methodology")} Proposed Methodology`, HeadingLevel.HEADING_2), bodyParagraph(data.methodology));

  function renderProseList(sectionNum, title, value) {
    const hasContent = value && ((value.intro || "").trim() || (Array.isArray(value.items) && value.items.some((i) => i.trim())) || (value.closing || "").trim());
    if (!hasContent) return;
    children.push(heading(`${sectionNum} ${title}`, HeadingLevel.HEADING_2));
    if (value.intro && value.intro.trim()) children.push(bodyParagraph(value.intro.trim()));
    (value.items || []).map((s) => s.trim()).filter(Boolean).forEach((i) => children.push(bulletParagraph(i)));
    if (value.closing && value.closing.trim()) children.push(bodyParagraph(value.closing.trim()));
  }
  renderProseList(numberOf("tech-qc"), "Quality Control Plan", data.qualityControl);
  renderProseList(numberOf("tech-risk"), "Risk Management", data.riskManagement);

  // ── Key Personnel ──
  children.push(
    heading(`${numberOf("key-personnel")}. Key Personnel`, HeadingLevel.HEADING_1),
    table(["Name", "Role", "Experience", "% Allocation"], data.personnel.map((p) => [p.name, p.role, p.experience, p.allocation]), [20, 20, 45, 15])
  );

  // ── Past Performance ──
  children.push(heading(`${numberOf("past-performance")}. Past Performance`, HeadingLevel.HEADING_1));
  data.pastPerformance.forEach((pp, i) => {
    const rows = [
      ["Contract #", pp.contractNumber], ["Agency", pp.agency], ["Period", pp.period], ["Value", pp.value],
      ["Scope", pp.scope], ["Relevance to This Requirement", pp.relevance],
    ];
    if (pp.contractType) rows.push(["Contract Type", pp.contractType]);
    if (pp.primeOrSub) rows.push(["Role", pp.primeOrSub]);
    rows.push(["Reference", pp.reference], ["Reference Email", pp.referenceEmail]);
    if (pp.cpars) rows.push(["CPARS Rating", pp.cpars]);
    children.push(keyValueTable(rows));
    if (i < data.pastPerformance.length - 1) children.push(new Paragraph({ spacing: { after: 200 } }));
  });

  // ── Price Proposal ──
  children.push(
    heading(`${numberOf("price-proposal")}. Price Proposal`, HeadingLevel.HEADING_1, true),
    table(
      ["CLIN", "Description", "Quantity", "Unit", "Unit Price", "Ext. Price"],
      [
        ...data.pricing.map((row) => [row.clin, row.description, row.quantity, row.unitOfMeasure, formatCurrency(row.unitPrice), formatCurrency(computeExtended(row.quantity, row.unitPrice))]),
        ["", "", "", "", "Total Evaluated Price", formatCurrency(totalPrice)],
      ],
      [10, 35, 12, 10, 16, 17]
    )
  );
  if (data.fobTerm) children.push(boldParagraph(data.fobTerm));
  if (data.basisOfEstimate) children.push(heading(`${numberOf("price-boe")} Basis of Estimate`, HeadingLevel.HEADING_2), bodyParagraph(data.basisOfEstimate));
  const assumptions = (data.assumptions || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (assumptions.length) {
    children.push(heading(`${numberOf("price-assumptions")} Assumptions`, HeadingLevel.HEADING_2));
    assumptions.forEach((a) => children.push(bulletParagraph(a)));
  }

  // ── Delivery Schedule (fully optional) ──
  if (outline.some((s) => s.id === "delivery-schedule")) {
    children.push(
      heading(`${numberOf("delivery-schedule")}. Delivery Schedule`, HeadingLevel.HEADING_1),
      table(
        ["CLIN", "Destination", "Quantity", "Delivery"],
        data.deliverySchedule.map((row) => [row.clin, row.destination, row.quantity, row.daysAfterReceipt ? `${row.daysAfterReceipt} days after receipt of order` : (row.deliveryDate || "")]),
        [12, 38, 15, 35]
      )
    );
  }

  // ── Warranty (fully optional) ──
  if (outline.some((s) => s.id === "warranty")) {
    children.push(heading(`${numberOf("warranty")}. Warranty`, HeadingLevel.HEADING_1));
    if (data.warrantyPeriod) children.push(boldParagraph(`Warranty Period: ${data.warrantyPeriod}`));
    if (data.warrantyTerms) children.push(bodyParagraph(data.warrantyTerms));
  }

  // ── Representations & Certifications (fully optional) ──
  if (outline.some((s) => s.id === "reps-certs")) {
    children.push(heading(`${numberOf("reps-certs")}. Representations and Certifications`, HeadingLevel.HEADING_1));
    if (data.samRegistrationActive) {
      children.push(bulletParagraph(`SAM registration: Active${data.uei ? ` (UEI: ${data.uei})` : ""}${data.samExpirationDate ? `, expires ${data.samExpirationDate}` : ""}`));
    }
    if (data.businessSize) children.push(bulletParagraph(`Business size: ${data.businessSize}`));
    (data.setAsideCategories || []).forEach((cat) => children.push(bulletParagraph(`Socioeconomic set-aside claimed: ${cat}`)));
  }

  // ── Running footer — new for the Word export. Unlike the PDF's CSS
  // @page margin-box attempt (which Chrome has never reliably rendered),
  // this uses docx's native PageNumber fields inside a real Word footer,
  // which Word computes against its own actual pagination every time the
  // document is opened — this is a core, well-supported Word feature,
  // not an edge-case spec feature, so it doesn't carry the same
  // reliability caveat the PDF version does.
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
        children: [
          new TextRun({ text: `Solicitation No. ${data.solicitationNumber || "\u2014"}`, size: 17, color: "8A94A6" }),
          new TextRun({ text: "\t" }),
          new TextRun({ text: "Page ", size: 17, color: "8A94A6" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 17, color: "8A94A6" }),
          new TextRun({ text: " of ", size: 17, color: "8A94A6" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: "8A94A6" }),
        ],
      }),
    ],
  });

  const doc = new Document({
    features: { updateFields: true },
    sections: [{ footers: { default: footer }, children }],
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 22 } },
        heading1: { run: { font: "Calibri", size: 28, bold: true, color: NAVY_HEX } },
        heading2: { run: { font: "Calibri", size: 24, bold: true, color: NAVY_HEX } },
      },
    },
  });

  return Packer.toBlob(doc);
}