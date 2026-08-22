// src/data/changelog.js
//
// Site version + running changelog, shown on the Dashboard's VersionCard.
// Convention: bump SITE_VERSION and prepend a new entry here on each major
// site change — not every small fix, but new features / significant
// rebuilds. Newest entry first.

export const SITE_VERSION = '2.4'

export const CHANGELOG = [
  {
    version: '2.4',
    date: '2026-08-21',
    notes: [
      'Retired the Lab Pro membership tier — its exclusive perks (live Q&A, priority support, Make.com library, sourcing intel channel, niche deep-dives) now live inside Founding Member instead',
      'Matched Opportunities and Suggested Bid are now available to Lab Member, not just Pro/Founding',
      'Suggested Bid pricing changed to $2 per opportunity for Lab Member, $1 for Founding members',
    ],
  },
  {
    version: '2.3',
    date: '2026-08-20',
    notes: [
      'New "Take the quiz to put you on the right learning path" on the Dashboard — a few questions on where you are in your GovCon journey, matched to free course / playbook / tool recommendations for your stage',
      'Suggested Bid can now recommend a specific GovCon Lab product directly in its risk notes when it genuinely addresses a gap it identifies, with a real link',
      'Suggested Bid\'s Approach and Risk Notes now render as scannable bullet points instead of paragraphs',
      'Matched Opportunities now pulls SAM.gov results per your registered NAICS/PSC codes instead of one shared daily pull — removes the previous ~1,000-opportunity daily ceiling entirely, and updates within about a minute of saving new codes in Matching Preferences',
      'Fixed a bug that silently capped opportunity matching at 1,000 open listings — real matches for active NAICS/PSC codes were being missed; now checks everything',
      'Stale matches now clear out automatically when you remove a NAICS/PSC code from Matching Preferences',
      'New interactive quiz on the public /go landing page for prospective members',
    ],
  },
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
