// src/lib/naics.js
//
// NAICS 2022 reference data + lookup helpers for the Proposal Builder's
// NAICS selector.
//
// PROVENANCE: src/data/naics.json (2,122 entries) is machine-generated,
// not hand-typed. Census.gov itself wasn't directly reachable from the
// build environment this was assembled in, so the data was pulled from a
// GitHub-hosted CSV mirror (TAS-Technologies-Group/NAICS,
// naics_2022_code_file.csv, which cites the U.S. Census Bureau's 2022
// NAICS Structure file as its source) and then spot-checked against
// several independent third-party NAICS lookup sites for the two codes
// directly involved in the original bug — 339113 (real code, wrong
// industry for this proposal) and 315250 (the code that was actually
// meant, mis-typed from memory as the nonexistent 315280). Both matched.
//
// Scope: every 2-, 3-, 4-, 5-, and 6-digit code (2,122 total). Deliberately
// excludes the three hyphenated top-level sector ranges (31-33
// Manufacturing, 44-45 Retail Trade, 48-49 Transportation and Warehousing)
// — those span multiple sectors rather than naming one industry, don't fit
// clean 2-6 digit numeric validation, and no business would realistically
// self-declare a 3-sector range as "their" NAICS code on a proposal.

import naicsData from '../data/naics.json'

export const NAICS_CODES = naicsData
export const MAX_NAICS_SELECTIONS = 5

const byCode = new Map(NAICS_CODES.map(entry => [entry.code, entry]))

/** True only if the code is a real, current 2-6 digit NAICS code. */
export function isValidNaicsCode(code) {
  return byCode.has(String(code).trim())
}

/** Official title for a code, or null if it isn't a real code. This is
 *  the only place a NAICS title is produced — never user-typed. */
export function getNaicsTitle(code) {
  const entry = byCode.get(String(code).trim())
  return entry ? entry.title : null
}

/** Search by code prefix (numeric query) or keyword anywhere in the title
 *  (non-numeric query). Capped so a broad term like "manufacturing"
 *  doesn't dump hundreds of rows into the dropdown at once. */
export function searchNaics(query, limit = 25) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const isNumeric = /^\d+$/.test(q)
  const results = NAICS_CODES.filter(entry =>
    isNumeric ? entry.code.startsWith(q) : entry.title.toLowerCase().includes(q)
  )
  return results.slice(0, limit)
}
