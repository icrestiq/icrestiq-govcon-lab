// src/data/changelog.js
//
// Site version + running changelog, shown on the Dashboard's VersionCard.
// Convention: bump SITE_VERSION and prepend a new entry here on each major
// site change — not every small fix, but new features / significant
// rebuilds. Newest entry first.

export const SITE_VERSION = '2.2'

export const CHANGELOG = [
  {
    version: '2.2',
    date: '2026-08-18',
    notes: [
      'AI-Powered Bid Matching: daily SAM.gov opportunity ingestion, matched to member profiles by NAICS/PSC code overlap',
      'Member-defined bid criteria with automatic go/no-go rules (value range, agency allow/deny, deadline lead time, set-aside match)',
      'AI fit scoring on matched opportunities, with plain-English reasoning, for members who skip manual bid criteria',
      'Suggested Bid: per-use AI bid draft (price range, approach, risks) grounded in real historical federal award data, plus AI-researched supplier and shipping/packaging leads — available to Lab Pro ($7) and Founding ($2) members',
    ],
  },
]
