// src/lib/validateProposal.js
//
// Guards against exactly the bug that prompted this file: a proposal
// where the CLIN table's Total Evaluated Price and a "total price" figure
// typed into narrative prose (most often 6.1 Basis of Estimate) disagree,
// because the narrative was written or edited before the pricing table
// was finalized and never revisited.
//
// Why this is a scan-and-block, not an auto-fix: basisOfEstimate,
// assumptions, and the other fields checked here are free text the user
// writes — there's no single computed value to substitute into "the
// total proposed price is $X" the way there is for the CLIN table's own
// Total Evaluated Price row (see pricing.js, computeGrandTotal — that
// value already flows unchanged into every output: the on-screen
// preview, the Word export, and the server-rendered PDF, all three read
// the same totalPrice argument, never a separately hardcoded figure).
// Prose has no equivalent single source of truth to draw from, so the
// only safe move when it disagrees with the table is to stop and tell
// the person, not guess which number is right and silently rewrite their
// sentence.
//
// SCOPE / KNOWN LIMITATION: this only catches a dollar figure that
// appears near total/evaluated/proposed/contract + price/cost/value
// language — deliberately, not every dollar figure in the document.
// Past Performance records legitimately cite unrelated past-contract
// dollar values (e.g. "$184,750"), and flagging every dollar amount
// against this proposal's total would bury the real problem in false
// positives. Those fields are intentionally not scanned. A dollar amount
// with no "total"-style phrase nearby — anywhere — is not flagged; this
// is a targeted check for the specific failure mode reported, not a
// general-purpose financial proofreader.

import { computeGrandTotal, formatCurrency, toNumber } from "./pricing.js";

const TOTAL_PHRASE_RE = /\btotal\s+(?:proposed\s+|evaluated\s+|contract\s+)?(?:price|cost|value)\b[^$]{0,40}\$\s?([\d,]+(?:\.\d{1,2})?)/gi;

// Fields a person might plausibly narrate a total price into. Deliberately
// excludes pastPerformance (own, unrelated contract values), pricing (the
// table itself, already the source of truth), and pure identity/contact
// fields where a stray dollar figure would never legitimately appear.
function proseFieldsToScan(data) {
  const flattenProseList = (v) => [v?.intro, ...(Array.isArray(v?.items) ? v.items : []), v?.closing].filter(Boolean).join("\n");
  return [
    ["Understanding of the Requirement", data.requirementSummary],
    ["Company Snapshot", data.companySnapshot],
    ["Proposed Methodology", data.methodology],
    ["Quality Control Plan", flattenProseList(data.qualityControl)],
    ["Risk Management", flattenProseList(data.riskManagement)],
    ["Basis of Estimate", data.basisOfEstimate],
    ["Assumptions", data.assumptions],
    ["Warranty", [data.warrantyPeriod, data.warrantyTerms].filter(Boolean).join("\n")],
  ];
}

/**
 * Scans prose fields for a stated "total price/cost/value" dollar figure
 * that doesn't match the CLIN table's actual computed total.
 * @returns {Array<{field: string, statedText: string, statedValue: number, statedFormatted: string}>}
 */
export function findProseTotalMismatches(data) {
  const computedTotal = computeGrandTotal(data.pricing);
  const mismatches = [];

  for (const [fieldLabel, text] of proseFieldsToScan(data)) {
    if (!text || typeof text !== "string") continue;
    for (const match of text.matchAll(TOTAL_PHRASE_RE)) {
      const statedValue = toNumber(match[1]);
      // Half-cent tolerance — this is a stale-figure check, not a
      // floating-point-equality trap.
      if (Math.abs(statedValue - computedTotal) > 0.005) {
        mismatches.push({
          field: fieldLabel,
          statedText: match[0].trim(),
          statedValue,
          statedFormatted: formatCurrency(statedValue),
        });
      }
    }
  }
  return mismatches;
}

export class ProposalValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProposalValidationError";
    this.isValidationError = true;
  }
}

/**
 * Throws a ProposalValidationError (isValidationError: true) naming every
 * mismatched figure and the actual computed total, if any prose total
 * disagrees with the CLIN table. Call before generating any export.
 */
export function assertProposalTotalsMatch(data) {
  const mismatches = findProseTotalMismatches(data);
  if (mismatches.length === 0) return;

  const computedFormatted = formatCurrency(computeGrandTotal(data.pricing));
  const details = mismatches
    .map((m) => `${m.field}: "${m.statedText}" states ${m.statedFormatted}`)
    .join("; ");

  throw new ProposalValidationError(
    `Export blocked: narrative text doesn't match the Price Proposal table. ${details}. ` +
    `The CLIN table's Total Evaluated Price is ${computedFormatted}. ` +
    `Update the narrative to match before exporting.`
  );
}