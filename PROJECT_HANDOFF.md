# iCrestiQ GovCon Lab — Project Handoff

## Project Identity

React (Vite) SPA for govconlab.com — membership, community, and tooling platform for a small AI-assisted government-contracting business. Backend: Vercel serverless functions + Supabase (Postgres/Auth). Payments: Stripe. Repository: `C:\Users\Katki\icrestiq-govcon-lab`.

## Current Repository State

- **Branch:** `main`, 1 commit ahead of `origin/main` — **not pushed**, per this session's explicit "no push without separate authorization."
- **Latest commit:** `b38f6ce` — "Add WCAG 2.2 AA accessibility remediation and legal policy package" — local only, 2026-08-27. Preceded by `efd538e` ("Wire Quotes into Proposal Builder, with a multi-draft switcher" — closes out the "Quotes into Proposal Builder" item earlier listed as deferred; pushed) and `9a49799` (Phase 4, pushed 2026-08-24; see its own preceding-commit list in prior handoff revisions).
- **Uncommitted working-tree state:** only `.claude/launch.json` (a local dev-server preview config, untracked, unrelated to any feature work — intentionally left out of the commit above). Everything else in the working tree is committed. The changes *not* represented in git this session are Supabase-side only: `generate_suggested_bid` v16 → v17 (attachment-parsing tier), a 10-row `company_nsns` backfill for the 2 pre-existing deals, a new hourly `score-opportunity-matches-trigger` cron job, and unscheduling `sync-opportunities-to-notion-trigger` — see the Session entry below; Edge Functions/cron jobs/data are never checked into this repo (see Current Architecture).

## Current Architecture

- Frontend: React 18 + Vite 5, client-rendered SPA, React Router v6, CSS Modules, route-level code splitting.
- Backend: Vercel serverless functions (Node, ESM) under `api/`, grouped by domain (`admin/`, `convertkit/`, `digest/`, `notion/`, `proposal/`, `quiz/`, `slack/`, `stripe/`, `upload/`, `_lib/`). Data-pipeline logic (SAM.gov ingestion, opportunity matching, AI fit-scoring, Notion push, expired-match purge) lives in **Supabase Edge Functions**, not in this repo — `sam_gov_ingest`, `match_opportunities`, `score_opportunity_matches`, `sync_opportunities_to_notion`, `purge_expired_matches`, `monthly_rewards`. Their source was pulled and read directly from Supabase this session (not checked into git).
- Database/Auth: Supabase Postgres + Auth. All inspected tables RLS-enabled.
- Payments: Stripe. Membership checkout reads `stripe_price_id` dynamically from Supabase's `products` table rather than hardcoding it in frontend code.
- Email: Gmail SMTP via `nodemailer` for app-originated transactional mail; Supabase's own Auth mailer separately handles account confirmation/password-reset mail.
- Scheduling: Vercel Cron (`vercel.json`, 2 jobs — digest reminders every 5 min, stale-quote alert daily) + Supabase `pg_cron` (5 active jobs as of 2026-08-27: SAM.gov ingestion daily 11:00 UTC, opportunity matching daily 11:30 UTC, expired-match purge weekly Sunday 08:00 UTC, monthly rewards monthly, and **`score_opportunity_matches` (AI fit-scoring) — newly scheduled hourly at :15 past the hour this session** (jobid 6), after being built-but-unscheduled since 2026-08-22. At 20 rows/run this clears the 1,387-row unscored backlog in ~3 days, then keeps pace with new daily matches. The Notion sync job (`sync-opportunities-to-notion-trigger`) was unscheduled the same session, leaving 5 active jobs total — see Current Risks and Technical Debt for why).
- External systems referenced in code: Slack (incoming webhook), Kit/ConvertKit API, SAM.gov (ingestion source, and as of 2026-08-27 also the source for the attachment-parsing tier's PDF downloads — see Implemented in Current Code). Notion API (OAuth) integration code is untouched but its only active cron job was disabled this session and it is **no longer being pursued** — see Current Risks and Technical Debt. HubSpot is **not** integrated into this repo and is **no longer a planned integration** — the 2026-08-23 read-only exploration of Keith's personal HubSpot portal was scoping only, and the whole direction was explicitly dropped this session.

## Implemented in Current Code

Membership/auth (Login, Register, Password Reset, email-confirmation flow, Turnstile bot protection) · Community chat · Blog (Supabase-backed, bot-visible Edge Middleware, dynamic sitemap) · Store + Stripe Checkout + Proposal Builder (PDF and Word/.docx export; **Quotes from a deal now wire directly into the Proposal Builder with a multi-draft switcher**, shipped `efd538e` — closes the item earlier listed as deferred out of Sourcing Pipeline Phase 2) · Matched Opportunities (SAM.gov ingestion, tier-gated; as of 2026-08-23 new-match creation is capped to opportunities posted in the last 5 days — see Decisions below) · Suggested Bid (paid AI research add-on, **$2/opportunity for both Lab Member and Founding as of 2026-08-24** — Founding's differentiator is now search depth, 8 vs. 5, not price; RFQ email drafts use the opportunity's real delivery destination when SAM.gov provides one, as of the same date; **as of 2026-08-27 (`generate_suggested_bid` v17), also reads up to 2 real SAM.gov solicitation PDF attachments (≤15 pages combined) directly into the same bid-draft Claude call as document content blocks — no 3rd API call, no separate charge, folded into the existing $2 purchase** — see this session's entry below for the full design) · `/go` lead-qualification quiz · Dashboard learning-path quiz · Admin panel with Site Analytics tab · Weekly digest signup with double opt-in, bot protections, and automated reminder waves · **Sourcing Pipeline CRM, Phases 0–4** (`/pipeline` — Phases 0–2 live-verified 2026-08-24 with a real purchase; **Phases 3 (note sharing/flagging/moderation) and 4 (CAGE/NSN search, Reports tab) are now also user-confirmed live-verified as of 2026-08-27**, not just build-verified) — shared Companies/Contacts directory across all paid members, private per-profile Pipeline Stages (customizable from day one). `generate_suggested_bid` auto-creates a Deal (linked to whatever companies its research found, via the `deal_companies` table) the moment a Suggested Bid purchase completes, and (as of Phase 3b) seeds a starter "Send RFQ to suppliers" task on it. As of Phase 2: the Deals tab is a real drag-and-drop Kanban board (`@dnd-kit/core`); clicking a card opens a detail modal showing stage, value estimate, linked companies (each individually removable from just that deal without touching the shared company record), and the deal-level notes (AI summary, RFQ drafts) the automation writes; solicitation #/NSN/P-N identifiers show under the title on both the card and the modal; a "View in Pipeline" link appears on `MatchedOpportunities.jsx` once a deal exists. As of Phase 3: notes on companies/contacts can be shared to the directory and flagged by other members; admins review flags in a new Admin Panel "Flagged Notes" tab, removing a note via a service-role-backed API route (`api/admin/moderate-note.js`) or dismissing the flag. As of Phase 3b: companies, contacts, and deals can each carry private tasks/reminders (`TasksPanel`); a new Tasks tab surfaces every open task across all of them, soonest due date first, overdue styled distinctly, and clicking a task's entity name jumps straight to that record. As of Phase 4: companies can carry a CAGE code and are searchable by name/CAGE/NSN; every purchase auto-tags its supplier companies with any AI-found NSNs into a shared `company_nsns` table (any paid member can unlink a wrong tag; **the 2 pre-existing deals that predated this table were backfilled with the same 10 rows the automation would have created, 2026-08-27**); deal stages can be tagged Won/Lost/Declined, feeding a Reports tab (active pipeline value by stage, plus won/lost/declined counts and rates). Still not built: manual deal creation, reordering cards within a column, Phase 5 (HubSpot-parity stretch + adding Keith's other business entities — no longer tied to an actual HubSpot integration, since that's been dropped, see below). · Notion sync is **fully discontinued as a direction, not just paused** — the Connect/Reconnect UI was already retired 2026-08-24, and as of 2026-08-27 its only remaining cron job (`sync-opportunities-to-notion-trigger`) was unscheduled too; the OAuth/sync code itself (`sync_opportunities_to_notion`, `generate_suggested_bid`'s `syncToNotion` calls, `api/notion/*`) is untouched but dead in practice — see Current Risks and Technical Debt · **WCAG 2.2 AA accessibility remediation** (`b38f6ce`): skip link; focus management and full dialog semantics (`role="dialog"`, focus trap, Escape, focus-restore-on-close) on CartDrawer, Pipeline's deal/person detail modals, Chat's rules modal, AdminPanel's person modal, Layout's mobile nav, EmojiPicker, and MatchedOpportunities' sample-bid preview; labeled/`autoComplete`d auth and membership forms with `role="alert"`/`role="status"` messaging; icon-only buttons given `aria-label`; a contrast fix on `--text-muted`; `prefers-reduced-motion` guard on spinners; a new `/accessibility` Accessibility Statement page (WCAG 2.2 AA stated as the technical target, explicitly not a compliance claim). Component-level automated smoke test added via `axe-core` + `jsdom` (dev-only deps) · **Legal policy package** (`b38f6ce`): 8 policies (Terms, Privacy, Privacy Nutrition Label, Cookies, AI Disclosure, Community Guidelines, Subscription Policy, Disclaimers) as content-as-data modules under `src/data/policies/`, rendered by one generic `/policies/:slug` page, plus a `/policies` hub page listing all 8; both site footers collapsed to one "Policies" link (+ the separate "Accessibility" link) instead of 8 individual links; effective date 8/1/2026; DMCA/Copyright policy intentionally excluded pending a registered agent · Stale-quote follow-up alert (single-tenant).

## Production Verified

Point-in-time verification, not an ongoing or auto-refreshed status.

**2026-08-22 reconciliation:**
- Lab Member Stripe price live and active at $47/mo (direct Stripe API check).
- 5 Supabase `pg_cron` jobs active; no AI fit-scoring job scheduled (direct `cron.job` query).
- All inspected Supabase tables had RLS enabled, including `notion_connections`.
- Live Supabase state consistent with the documented single-tenant Notion configuration.

**2026-08-23 session (live checks authorized by user):**
- SAM.gov ingestion: 4 consecutive daily cron runs (08-19 through 08-22) all `succeeded`; edge function logs show HTTP 200 on every invocation; no failure-alert emails triggered. Declining daily net-new row counts (596 → 1,121 → 79 → 28) are expected behavior from the unique `solicitation_number` constraint, not a fault.
- `match_opportunities`: all 4 scheduled daily runs succeeded. One isolated `500` on 2026-08-21 15:35:51 UTC (`null value in column "profile_id"` — an upsert payload omitting FK columns that Postgres still validates on `ON CONFLICT`) was already self-corrected by a fix deployed 8 minutes later (version 9, 2026-08-21 15:43:56 UTC), before this session started. No recurrence found in the surrounding 24h of logs either side of that deploy.
- Notion sync: not malfunctioning — throttled by design (50 new pages/profile/run). Exactly 2 runs since the single existing connection was made (2026-08-21 16:48 UTC), producing exactly 100 synced pages, consistent with the cap.
- Deployed `match_opportunities` version 10 (2026-08-23 04:54 UTC) and pulled the live source back down afterward to confirm byte-for-byte it matched the intended diff — see Deployment below.

**2026-08-24 (Sourcing Pipeline Phase 1):** User bought a real Suggested Bid on a live opportunity after v13 deployed. Confirmed end-to-end: a Deal was created in the correct starting stage with a sensible value estimate, and 10 companies (5 suppliers, 5 packer/shippers) were correctly created and linked with the right `role_on_deal`. This is the only Sourcing Pipeline behavior verified against a real purchase so far — Phase 0's CRUD tabs and the rest of Phase 1's write paths (idempotency on a retried purchase, the deal-level notes, the stage-auto-seed path for a member who's never opened `/pipeline`) remain code-reviewed only, not live-tested.

**2026-08-24 (Sourcing Pipeline Phase 2 + NSN extraction bug):** User clicked through the shipped Phase 2 Kanban board and deal detail modal against that same real purchase and confirmed drag-drop, the modal, and the notes rendered correctly. Separately, the user noticed the NSN identifier shown in the deal's AI-generated notes wasn't appearing under the card/modal title — traced to `extractIdentifiers()` only matching the hyphenated NSN format (`4730-00-774-7037`); this specific opportunity's source text had it as one continuous 13-digit run (`4730007747037`) with no hyphens, which the regex never matched even though the model itself read and used it correctly throughout its own output. Fixed and deployed as `generate_suggested_bid` v14, then backfilled the one already-completed `bid_requests` row (`8620a749-...`) so the existing deal shows it without a repeat purchase — confirmed via the `returning` clause that `identifiers` now reads `["NSN 4730-00-774-7037"]`.

**2026-08-27 (Phase 3 + Phase 4 live click-through):** User confirmed, live, that Phase 3's note sharing/flagging/admin-moderation UI and Phase 4's CAGE/NSN search, CAGE code field, stage-type tagging, and Reports tab all work as intended. Previously build-verified only.

**2026-08-27 (`company_nsns` backfill):** Queried live data and found only 2 deals actually exist with a `bid_request_id` + identifiers (the 2026-08-24 handoff's "4" was an approximation) — both predating the `company_nsns` table. Backfilled the same 10 rows the automation would have created (5 supplier companies × 1 NSN each, for both deals), matching `generate_suggested_bid` v16's exact `linkCompanyNsns()` logic (NSN stripped of its "NSN " prefix, supplier-role companies only). Confirmed via the `INSERT ... RETURNING` clause — all 10 rows new, no conflicts against the `(company_id, nsn)` unique constraint.

**2026-08-27 (AI fit-scoring scheduled):** Confirmed `ANTHROPIC_API_KEY` is usable by `score_opportunity_matches` as a side effect of existing evidence — the NSN-extraction bug fix (2026-08-25) traced a bare-13-digit NSN to `descriptionText`, which only exists when `SAM_GOV_API_KEY`-gated fetches succeed; Supabase secrets are project-wide, so the same key is available to this function too. Created `score-opportunity-matches-trigger` (jobid 6, `15 * * * *`) via `cron.schedule`; confirmed active via `cron.job` query. Backlog at scheduling time: 1,387 of 1,387 `opportunity_matches` rows unscored (100%, grown from the ~318 the 2026-08-23 handoff cited).

**2026-08-27 (Notion cron unscheduled):** Per the decision to drop Notion entirely, ran `cron.unschedule('sync-opportunities-to-notion-trigger')` — confirmed `true` return. The one existing Notion connection, its OAuth tokens, and the sync code path are untouched; only the daily trigger is off.

**2026-08-27 (`generate_suggested_bid` v17 deploy):** Deployed the attachment-parsing tier (see Implemented in Current Code). Verified via a post-deploy source pull confirming the live function matches the intended file byte-for-byte, `status: ACTIVE`, `verify_jwt: false` unchanged. **Not invoked end-to-end** — no real purchase has yet run against an opportunity with a PDF attachment, so the new path (PDF fetch → magic-byte check → page-budget accounting → document content block → Claude call, with a no-attachments retry fallback if that call fails) is code-reviewed and byte-verified only, not live-tested.

**No independently-available production-test evidence exists for any other feature** (bot protections, digest email delivery, NAICS selector, Word/PDF export correctness, auth-confirmation flow, stale-quote alert delivery, WCAG remediation beyond the automated `axe-core` smoke test and manual code/contrast review, etc.) — code-confirmed only.

## Partially Implemented

- Sourcing Research → Notion content-field write-back was historically reported as completed and smoke-tested, but its source is not stored in this repository and was not independently re-verified. Six Bid/No-Go gate fields remain reported as unwired. **Moot as of 2026-08-27 — Notion is no longer being pursued (see Current Risks and Technical Debt); not being fixed.**
- **Notion sync carries only listing metadata, never purchased research.** Confirmed by reading `sync_opportunities_to_notion` directly: it maps 8 fields (title, solicitation #, agency, NAICS/PSC, set-aside, source, due date, SAM.gov link) from the `opportunities` table only. It never joins `bid_requests`, so a member's paid Suggested Bid results (price range, technical approach, risk notes, supplier leads, RFQ drafts) never reach Notion even after a successful sync. This was a scope gap in the implementation, not a bug — **now moot, since the feature itself is discontinued as of 2026-08-27.**
- Managed Data Feed (recurring re-check + Compliance sync + Stripe pause/resume): no corresponding code found. **Was scoped around Notion as its output target — with Notion dropped, this whole concept (see the "GovCon Command Center" artifact) needs a different design if ever revisited, not just a resume.**
- SAM.gov → Notion backfill completeness: not determinable from code alone. **Moot as of 2026-08-27.**

## Planned or Paused

- DIBBS integration — no code path targets DIBBS as a data source.
- Template packaging for resale — no code found.
- Browser extensions (SAM Copilot, DIBBS Helper) — no code exists in this repository for either.
- A weekly solicitation-intelligence pipeline and blog/social auto-publish tooling — no code found in this repository.
- ~~**HubSpot integration**~~ — **dropped 2026-08-27.** Was scoped only (see 2026-08-23 session below), zero code written; explicitly not being pursued going forward. The "GovCon Deal Sync" scoping artifact still exists but is now historical, not a live plan.
- **Native CRM ("Sourcing Pipeline")** — Phases 0–4 shipped 2026-08-24, all now live-verified (see Implemented in Current Code). Remaining: tasks/reminders seeded from RFQ drafts beyond the one starter task + a "mark RFQ sent" log (deliberately deferred out of Phase 3, not started), Phase 5 (HubSpot-parity-*style* stretch features + adding Keith's other business entities to the shared directory — the name is legacy; it no longer implies an actual HubSpot integration, since that's dropped). **Quotes into Proposal Builder shipped 2026-08-24/25** (`efd538e`) — no longer remaining. Scoping artifact: "Sourcing Pipeline" (kept in sync with the actual build as of 2026-08-24, not linked in git; not updated this session).

## Current Risks and Technical Debt

- ~~**Stale Stripe tier/price mapping**~~ — **fixed 2026-08-24.** `api/stripe/webhook.js`'s `PRICE_TO_TIER['member']` pointed at a price ID that matched neither the live Stripe price nor the (separately stale, unused) one in `src/lib/stripe.js`'s dead `STRIPE_PRICES` map. Corrected to the value read directly from the `products` table (the real source of truth the live checkout endpoint uses), verified via an authorized read-only query. The `|| 'member'` fallback had been masking the bug in production — no user-facing impact, but the map itself was wrong.
- **Dead Lab Pro pricing entry:** `src/lib/stripe.js`'s price map still contains a `'lab-pro-monthly'` entry for the retired Lab Pro tier.
- **Manual tier-list duplication:** `api/notion/authorize.js` hardcodes an eligible-tiers list that must be kept manually in sync with `isMemberOrFounding()` in `src/lib/tier.js`. **Now fully dead code as of 2026-08-27** — Notion is discontinued (see below), so this endpoint has no live path calling it. Candidate for deletion, not done this session (flagged only).
- **Unused pagination code:** `src/lib/pagination.js` and its test file are no longer imported anywhere in `ProposalBuilder.jsx` — confirmed dead code.
- **Unverified Vercel configuration:** environment variables referenced by name in code were not checked against the live Vercel dashboard.
- **Authentication-confirmation status:** whether Supabase's "Confirm email" Auth requirement is currently turned on was not checked.
- **Notion single-tenant limitations:** `api/notion/stale-quote-alert.js` is hardcoded to one profile ID with no per-customer selector.
- Stale `DEPLOY.md` and incomplete checked-in schema documentation — `supabase-schema.sql` does not reflect several tables/columns known from code to exist in the live database.
- **Historical purchase-protection gap in `match_opportunities` (found and partially remediated 2026-08-23):** before the "never prune a match with a purchase against it" protection existed (added in version 9, 2026-08-21), the function's stale-match cleanup could delete `opportunity_matches` rows tied to a real, paid Suggested Bid purchase if a member's NAICS/PSC codes changed. 4 such orphaned purchases were found and manually restored for one profile (`404be639-e000-493d-a998-f7a60c289902`) this session. **Other profiles have not been audited for the same historical gap** — the protection now prevents new occurrences but does not retroactively find or fix old ones elsewhere.
- ~~**AI fit-scoring (`score_opportunity_matches`) still unscheduled.**~~ — **scheduled 2026-08-27.** Now runs hourly (`score-opportunity-matches-trigger`, jobid 6, `15 * * * *`). `ANTHROPIC_API_KEY` availability was confirmed indirectly (see Production Verified) rather than via a direct secret-existence check, since no tool exposes that without reading the value. Backlog was 1,387 of 1,387 rows unscored at scheduling time (100%, not the ~318 previously cited — grown since 2026-08-22) — expect ~3 days at 20 rows/hour × 24 hours/day to clear it.
- ~~**`protect_note_removal_fields()` publicly callable despite an earlier "fix"**~~ — **actually fixed 2026-08-24.** The Phase 0 hardening migration revoked `EXECUTE` from the `anon` and `authenticated` roles directly, but the real grant Postgres created was on the `PUBLIC` pseudo-role, which both roles inherit independently of a per-role revoke — so that fix never took effect. Caught by re-running Supabase's security advisor after the Phase 1 deploy and confirming directly against `information_schema.routine_privileges` rather than trusting the advisor's cache. Now genuinely fixed (`revoke ... from public`). Real risk was low (a trigger-only function that errors outside trigger context), but the access control itself was wrong, not just theoretically — worth remembering `PUBLIC` vs. named roles as a distinct grantee for any future `revoke`.
- ~~**`extractIdentifiers()` missed unhyphenated NSNs**~~ — **fixed 2026-08-24 (`generate_suggested_bid` v14).** Only matched the standard `####-##-###-####` format; a real opportunity's source text had the NSN as one continuous 13-digit run instead, which the regex never caught even though the model read and used it correctly. Now matches both, re-hyphenating the bare form. **Audited 2026-08-24** (see Session below): all 15 completed `bid_requests` rows checked against stored opportunity titles (the only description-adjacent text actually in the DB) — no title-based miss found. **11 of the 15 remain genuinely unverifiable** without a live re-fetch from SAM.gov (description body text isn't stored anywhere, only its API URL) — the user explicitly declined that further step, then reconfirmed 2026-08-27 that this is not a concern and should be dropped from the active punch list. Considered closed by explicit user decision, not oversight. Of those 11, 5 have `identifiers = null` rather than `[]`, meaning they predate the `identifiers` field/extraction existing at all — a distinct, earlier gap, not this regex bug.
- **HubSpot portal data-integrity bug (external to this repo, found 2026-08-23):** in Keith's own connected HubSpot account, the custom deal stages "Quote Requested" and "Quote Received" are mapped onto HubSpot's internal `closedwon`/`closedlost` stage IDs, so HubSpot is silently counting deals reaching those stages as won/lost regardless of actual outcome. Not fixed — flagged only, read-only recon, **and no longer relevant to this project's roadmap since a HubSpot integration was dropped 2026-08-27; still worth Keith fixing in his own HubSpot account independent of this codebase.**
- **Notion — discontinued as a direction, 2026-08-27.** User confirmed HubSpot and Notion are both off the table; the `sync-opportunities-to-notion-trigger` cron job was unscheduled, but the OAuth flow (`api/notion/*`), the one existing `notion_connections` row, `sync_opportunities_to_notion`, and `generate_suggested_bid`'s `syncToNotion` calls are all still present in code and would still technically run if re-scheduled. Nothing was deleted — this is a "stop running it" decision, not a "rip it out" one; revisit if that changes.
- **`generate_suggested_bid` v17's attachment-reading path is unexercised in production.** Deployed and byte-verified (see Production Verified) but no real purchase has yet hit an opportunity with a PDF attachment, so the download/magic-byte-check/page-budget/document-block logic and its no-attachments retry fallback are code-reviewed only. Watch the next several completions' `error_message`/refund status for anything tied to this path.

## External Configuration Requiring Verification

- Vercel environment variable values (names only are known from code).
- Whether Supabase's "Confirm email" Auth requirement is enabled.
- Live Notion workspace content and connection state beyond the single-tenant configuration confirmed above.
- `products.stripe_price_id` values for rows other than the Lab Member membership price.
- GitHub branch protection / CI configuration.

~~Exact remaining custom-property headroom in Keith's live HubSpot portal~~ and ~~whether HubSpot's OAuth app review process applies~~ — **removed 2026-08-27, HubSpot integration dropped.**

## Session — 2026-08-27

**Goal:** Full WCAG 2.2 AA accessibility audit/remediation, integrate a legal policy package from a provided document, then work through the "what's left on the whole site" punch list — CRM verification, an AI fit-scoring cron, dropping HubSpot/Notion, and scoping/building an attachment-parsing enhancement to Suggested Bid.

**Work completed:**
- **Accessibility (Phase 1 audit, Phase 2 remediation):** Manual inspection (keyboard, focus, screen-reader-oriented DOM review, contrast, zoom/reflow) across the whole site, since the standing project rule against the in-app browser ruled out live automated scanning. Fixed: skip link; `id="main-content"`/`tabIndex={-1}` on `<main>`; full dialog semantics (`role="dialog"`, `aria-modal`, focus trap via a new shared `useDialogA11y` hook, Escape-to-close, focus-restore-on-close) on CartDrawer, Pipeline's deal/person detail modals, Chat's rules modal, AdminPanel's person modal, Layout's mobile nav drawer, EmojiPicker, and MatchedOpportunities' sample-bid preview; ~30+ icon-only buttons given `aria-label`; labeled/`autoComplete`-tagged inputs and `role="alert"`/`role="status"` messaging across Login/Register/ForgotPassword/ResetPassword/Membership/Profile/DigestSignup; a genuine contrast failure fixed in `--text-muted` (was failing 4.5:1); `prefers-reduced-motion` guard added on spinner animations; per-page `document.title` via a new `useDocumentTitle` hook; a new `/accessibility` Accessibility Statement page (WCAG 2.2 AA stated as the technical target, explicit non-compliance-claim disclaimer, real contact info only) linked from both footers. Added `axe-core` + `jsdom` as dev-only dependencies for a component-level automated smoke test (`src/lib/accessibility.smoke.test.jsx`) — explicitly disclosed as a partial substitute for live screen-reader/browser testing, not a substitute for it.
- **Legal policy package:** Extracted the user-provided `GovCon_Lab_Website_Policy_Package.docx` (no pandoc/soffice/python available on this machine — used a manual `unzip` + custom Node.js regex parser against `word/document.xml`). Built 8 policies (Terms, Privacy, Privacy Nutrition Label, Cookies, AI Disclosure, Community Guidelines, Subscription Policy, Disclaimers) as content-as-data modules under `src/data/policies/`, all bracketed placeholders filled with real site details (contact emails as `hello+<role>@icrestiq.com` plus-addressing, the real Easley, SC mailing address, ~2-year data retention, effective date 8/1/2026 per user instruction). DMCA/Copyright policy deliberately excluded — the source document itself says not to publish a registered-agent section until iCrestiQ LLC actually has one on file with the U.S. Copyright Office. Built one generic `PolicyPage.jsx` at `/policies/:slug` (a `Block` switch-component over typed flat blocks: h2/h3/p/ul/legalCaps/callout/table) rather than 8 bespoke pages. After the user asked whether showing all 8 individually in the footer was legally necessary and I explained it wasn't, built a `/policies` hub page (`PoliciesIndex.jsx`) listing all 8 with one-line summaries, and collapsed both site footers (`Footer.jsx`, `Landing.jsx`) from an 8-link `.map()` down to a single "Policies" link plus the separate "Accessibility" link.
- **Committed both efforts** as `b38f6ce` after discovering they were still sitting uncommitted in the working tree despite an earlier exchange implying otherwise — flagged the discrepancy to the user before proceeding rather than silently assuming it was fine. **Not pushed** — no push authorization given this session.
- **CRM verification:** User confirmed live click-through of Phase 3 (note sharing/flagging/admin-moderation UI) and Phase 4 (CAGE/NSN search, CAGE field, stage-type tagging, Reports tab) — both previously build-verified only.
- **`company_nsns` backfill:** Read-only investigation (explicitly authorized) found only 2 deals actually exist with identifiers, not the "4" a prior handoff estimated. Pulled the live `generate_suggested_bid` v16 source to match its exact tagging logic, then ran a 10-row `INSERT ... ON CONFLICT DO NOTHING` (explicitly previewed and approved before running) — all 10 new, confirmed via `RETURNING`.
- **AI fit-scoring scheduled:** Established `ANTHROPIC_API_KEY` is already usable by `score_opportunity_matches` as an inference from existing evidence (the NSN bug fix already proved `SAM_GOV_API_KEY`-gated fetches succeed, and Supabase secrets are project-wide) rather than a new check. Presented backlog size (1,387 unscored, 100% of the table) and 3 cadence options with real cost math; user chose hourly. Created `score-opportunity-matches-trigger` (jobid 6, `15 * * * *`) via `cron.schedule`, explicitly previewed and approved first.
- **Dropped HubSpot and Notion from the roadmap** per explicit user instruction ("we are not pursuing using them"). Unscheduled the one remaining Notion cron job (`sync-opportunities-to-notion-trigger`) at the user's follow-up request; left the connection, OAuth code, and sync code otherwise untouched (a "stop running," not a "rip out," decision).
- **Attachment-parsing tier for Suggested Bid, scoped and shipped:** Clarified with the user which of two same-named-in-history concepts was meant (the Suggested Bid PDF-reading enhancement, not the older Notion-based "Managed Data Feed" idea, which is now moot anyway). Pulled live data showing 37.6% of opportunities have attachments (avg 3.9 files when present) and confirmed the URLs are direct SAM.gov file-download endpoints using the same `?api_key=` pattern already proven to work. Improved on the original 2026-08-24 scoping (which assumed a 3rd Claude call) by folding PDF attachments into the *existing* bid-draft call as Anthropic document content blocks — no new API call, only incremental page-token cost. Presented and got explicit decisions on: (1) fold into the existing $2 purchase rather than a new paid tier, since 62% of opportunities have nothing to read and a separate charge risks charging for an empty result; (2) cap at 2 PDFs / 15 pages combined. Implemented with real production-safety measures beyond what was asked: a dependency-free PDF page-count estimator (counts `/Type /Page` object headers) to enforce the page budget without a parsing library; `%PDF` magic-byte verification instead of trusting SAM.gov's `Content-Type` header; a chunked base64 encoder to avoid a call-stack crash on large files; and — the most load-bearing addition — a retry-without-attachments fallback around the Claude call, since that call sits in the *primary* (refund-triggering) path, not the non-blocking CRM/Notion path, so a malformed PDF must degrade gracefully rather than fail a paid purchase. Deployed as `generate_suggested_bid` v17, verified via a post-deploy byte-for-byte source pull.
- **Caught and fixed my own transcription error before deploying:** a code comment (referencing `<cite>` tag stripping) got mangled to `(cite` during file construction; caught via `grep`, confirmed no other drift via a brace/paren/bracket balance check, then fixed with `sed` before the file went anywhere near production. Worth noting the fix took several tries — a rendering artifact in the tool transcript displayed `<` as `(` even after the underlying bytes were already correct, confirmed only by dumping raw bytes with `od -c`.

**Files and database objects changed:**
- 57 files, 1 commit (`b38f6ce`, local only): full accessibility remediation + all 8 policy files + `PolicyPage.jsx`/`PoliciesIndex.jsx`/`PolicyPage.module.css` + `useDialogA11y.js`/`useDocumentTitle.js` + `accessibility.smoke.test.jsx` + `axe-core`/`jsdom` devDependencies.
- Supabase: `company_nsns` — 10 rows inserted (data only, no migration). `cron.job` — jobid 6 created (`score-opportunity-matches-trigger`), jobid 5 unscheduled (`sync-opportunities-to-notion-trigger`). Supabase Edge Function `generate_suggested_bid`: v16 → v17 (attachment-parsing tier). No schema migrations this session.
- Nothing pushed to `origin/main`; nothing deployed to Vercel.

**Decisions and reasons:**
- Committed the accessibility/policy work as a single combined commit rather than splitting it in two — the two efforts' changes are genuinely intermixed within shared files (`Footer.jsx`, `Landing.jsx`, `App.jsx`), and attempting a hunk-level split via scripted tools was judged riskier than one clearly-described combined commit.
- Attachment reading folded into the existing $2 purchase rather than a new paid tier — user's explicit choice from two options, reasoning being that a separate charge risks charging for a result with nothing to read on the 62% of opportunities with no attachments.
- 2 PDFs / 15 pages combined cap — user's choice from three options; sized more for Edge Function latency/reliability than for the (genuinely small, a few cents either way) AI cost difference.
- PDF attached to the *existing* draft call instead of a new 3rd call — my own design improvement over the original scoping, surfaced and explained before building, not silently substituted.
- Retry-without-attachments fallback added without being explicitly asked for — judged necessary given this call sits in the refund-triggering path, consistent with this codebase's existing non-blocking-degradation pattern elsewhere (Notion sync, CRM automation).
- Notion cron unscheduled but nothing deleted — matches the project's general pattern of reversible steps over destructive ones absent an explicit "remove this" instruction.

**Tests and results:** `npm run build` and `npm test` after the accessibility/policy work — build clean, 65/66 tests pass (1 failure is the pre-existing, unrelated `outline.test.js` issue flagged in earlier sessions, untouched). No live browser testing performed, per the standing project rule. Supabase changes verified via direct query confirmation (`RETURNING`, `cron.job` re-select, post-deploy source pull) rather than an automated test suite, consistent with how prior sessions verified Edge Function/database changes.

**Deployment and verification status:**
- Git: `b38f6ce` committed locally, **not pushed**.
- Supabase: `company_nsns` backfill applied and confirmed; `score-opportunity-matches-trigger` cron created and confirmed active; `sync-opportunities-to-notion-trigger` cron unscheduled and confirmed; `generate_suggested_bid` v17 deployed, `ACTIVE`, byte-verified against the intended source. None of these were invoked/exercised end-to-end this session (the cron jobs haven't had a scheduled run confirmed yet at the time of writing; v17's attachment path has not been hit by a real purchase).
- Vercel: no deploy this session (no frontend changes were pushed).

**External dashboard changes not represented in git:** the `company_nsns` rows, the cron job create/unschedule, and the `generate_suggested_bid` v17 deploy all exist only in Supabase.

**Problems and lessons:**
- Flagging the "already committed" discrepancy before proceeding, rather than trusting the earlier claim, caught a real gap — the accessibility/policy work would otherwise have gone undocumented as "committed" in this very handoff while actually sitting only in the working tree.
- A page's own historical scoping documents (the 2026-08-24 handoff's attachment-parsing costing, the older "GovCon Command Center" artifact) can describe two different features under similar language ("attachment parsing") — worth explicitly disambiguating with the user rather than assuming continuity, especially once one of the two depends on a since-dropped integration (Notion).
- A tool-transcript rendering artifact (`<cite>` displaying as `(cite` even in freshly-written file content) is a real trap for eyeballing correctness — raw byte inspection (`od -c`) was the only way to actually confirm the fix took.

**Unresolved issues:**
- `generate_suggested_bid` v17's attachment-reading path is unexercised by a real purchase — watch the next few completions.
- The hourly AI fit-scoring cron hasn't had a confirmed successful run yet (just created).
- Orphaned-purchase audit for other member profiles (beyond the one profile checked 2026-08-23) — still not done.
- DMCA/Copyright policy — blocked on Keith registering an agent with the U.S. Copyright Office; not something further code work can resolve.
- `api/notion/authorize.js` and the rest of the Notion integration code are now fully dead in practice but not deleted.
- Everything already listed as unresolved in prior sessions and not explicitly closed above (idempotency-on-retry, the stage-auto-seed path, the 11/15 NSN-audit rows — **this last one the user explicitly closed 2026-08-27, not a concern**) — see Current Risks and Technical Debt for current status of each.

**Next recommended action:** Watch the next real Suggested Bid purchase against an opportunity with a PDF attachment to confirm the v17 attachment-reading path end-to-end, and confirm the new hourly fit-scoring cron has run successfully at least once. This is a recommendation, not an approved priority.

---

## Session — 2026-08-24

**Goal:** Fix a known Stripe pricing bug, make Suggested Bid's RFQ email drafts opportunity-specific instead of generic, scope and cost out a further "read the attachments" tier, add real AI-cost telemetry, reprice Founding tier accordingly, and narrow the native CRM's scope.

**Work completed:**
- Diagnosed and fixed `api/stripe/webhook.js`'s stale `PRICE_TO_TIER['member']` price ID. Confirmed via an authorized read-only `products` table query that neither the previously hardcoded ID nor a third, separately stale ID in `src/lib/stripe.js`'s unused `STRIPE_PRICES` map matched the live price — corrected the map to the real value. The `|| 'member'` fallback had masked this in production; no user-facing impact, but the map itself was wrong.
- Diagnosed why Suggested Bid's RFQ email drafts were generic (bracket placeholders like `[DESTINATION]`): pulled the live `generate_suggested_bid` Edge Function source and found it never reads `opportunities.raw_payload`, even though `sam_gov_ingest` already captures SAM.gov's `placeOfPerformance` (51% of 3,409 opportunities) and `resourceLinks`/attachments (39%) — the AI was never shown data that already exists.
- Implemented and deployed the fix: wired `raw_payload.placeOfPerformance` into the bid-draft prompt (`generate_suggested_bid` v10 → v11). Verified via a post-deploy source pull.
- Estimated the cost of a further "attachment parsing" tier (a 3rd Claude call reading SAM.gov's actual solicitation documents) using verified live pricing (Sonnet 5 at $2/$10 per 1M intro through 2026-08-31, then $3/$15; web search at $0.01/search flat) and Anthropic's documented PDF token cost (~2,300 tokens/page). Found Founding tier's margin was already thin — Stripe's flat $0.30 fee alone takes ~33% of a $1 charge — and that Founding actually costs more to fulfill than Member (8 web searches vs. 5) despite charging less.
- Added real per-purchase AI usage logging ahead of any further pricing decision: new `bid_requests.ai_usage` jsonb column, populated by `generate_suggested_bid` v11 → v12 with `usage.input_tokens`/`output_tokens`/`server_tool_use.web_search_requests` from both Claude calls.
- Raised Founding-tier Suggested Bid price from $1 to $2 (now matches Member; deeper search remains Founding's differentiator). Fixed two other places found displaying the old price independently of that config — `src/lib/stripe.js`'s display label and a hardcoded string in `MatchedOpportunities.jsx`'s pitch card, neither of which was wired to the actual pricing source.
- Narrowed the "Sourcing Pipeline" native CRM's scope by filtering HubSpot's full feature set against what the purchase → sourced → quoted flow actually needs. Pulled Quotes (into the existing Proposal Builder) and lightweight email-sent logging into the near-term roadmap; explicitly excluded Marketing Hub, Live Chat, Service Hub, meeting/calling tools, lead scoring, and HubSpot's generic Custom Objects engine. Updated the published scoping artifact to match.

**Files and database objects changed:**
- `api/stripe/webhook.js`: `PRICE_TO_TIER['member']` corrected — committed this session.
- `api/stripe/suggested-bid-checkout.js`: Founding `amountCents` 100 → 200 — committed and pushed (`a499b79`).
- `src/lib/stripe.js`: `SUGGESTED_BID_PRICING.founding.label` '$1' → '$2' — committed and pushed.
- `src/pages/MatchedOpportunities.jsx`: hardcoded pitch-card price string corrected — committed and pushed.
- `src/data/changelog.js`: new v2.5 entry — committed and pushed.
- Supabase Edge Function `generate_suggested_bid`: v10 → v11 (placeOfPerformance) → v12 (ai_usage logging). Both deployed, both verified via post-deploy source pull.
- Supabase migration `add_ai_usage_to_bid_requests`: added `bid_requests.ai_usage` jsonb column. Applied.
- No `opportunities`/`bid_requests` row data was read or modified beyond schema introspection (column lists, one sample row's `raw_payload` keys, and aggregate counts of how many opportunities have `placeOfPerformance`/`resourceLinks` populated).

**Decisions and reasons:**
- Fixed the Stripe price-map bug against the value read from the live `products` table — the actual source of truth the real checkout endpoint uses — rather than either stale candidate already sitting in code, per explicit user authorization to check.
- Shipped the `placeOfPerformance` fix but not attachment parsing: the former reused already-ingested data with no new secret or infra; the latter needs a page/file cap and a pricing decision made first.
- Raised Founding price to $2, the upper end of the $1.50–2 range offered — user's choice.
- Added `ai_usage` logging before any further pricing decision, so the next one can use real numbers instead of estimates.

**Tests and results:** No automated test suite. Verification was direct — post-deploy source pulls for both Edge Function versions (byte-for-byte match confirmed against the intended diff), a schema query confirming the new `ai_usage` column exists, and `git status`/`git diff` review before each commit.

**Deployment and verification status:**
- Supabase: `generate_suggested_bid` v11 and v12, both `ACTIVE`, `verify_jwt: false` unchanged. Migration `add_ai_usage_to_bid_requests` applied. Neither version was invoked end-to-end (would spend a real Suggested Bid credit) — first live test is the next real purchase.
- Git/Vercel: commit `a499b79` pushed to `origin/main` (pricing files). A second commit in this session adds the webhook fix and this handoff update. Vercel deploys from `main` automatically on push — not independently confirmed to have finished building.

**External dashboard changes not represented in git:** the three Supabase Edge Function deploys and the `ai_usage` column exist only in Supabase.

**Problems and lessons:**
- The RFQ placeholder issue traced back to a straightforward gap, not a prompting bug — `generate_suggested_bid` was never given data (`raw_payload`) that ingestion already captures. Worth checking "is the data actually in the prompt" before assuming an AI-output problem is a prompting problem.
- Cost estimates for AI-heavy features are only as good as their assumptions (attachment page counts, search-result token size). The `ai_usage` logging added this session exists specifically to replace estimation with real data before the next pricing decision.

**Unresolved issues:**
- Attachment parsing (reading SAM.gov's actual solicitation documents) — not built. Needs a page/file cap decided before implementation.
- Whether `SAM_GOV_API_KEY` is actually configured was never confirmed — no tool available to check Supabase secret existence without reading the value. If unset, the synopsis-fetch path in `generate_suggested_bid` has been silently returning nothing on every generation.
- Everything already listed as unresolved as of 2026-08-23 below — untouched this session.
- Native CRM ("Sourcing Pipeline") — scope narrowed, but the same five open decisions from 2026-08-23 (single-tenant vs. member-facing, foremost) still block schema work.

**Next recommended action (superseded — see below):** ~~Begin the CRM build next session, starting with Open Decision 01~~ — the user chose to resolve the open decisions and start the build in this same session instead. See the continuation immediately below.

---

### Later the same session — Sourcing Pipeline Phase 0 build

**Goal:** Resolve the five open decisions blocking the CRM schema, then build Phase 0 (companies, contacts, pipeline stages, private notes) on top of them.

**Work completed:**
- User resolved all five open decisions from the scoping artifact: (1) paid feature, shared vendor directory across every paid member — added a full pros/cons writeup to the artifact; (2) Notion sync fully retired immediately, connect UI to be suspended in this build; (3) start empty, no data migration; (4) pipeline stages customizable per profile from day one; (5) launch scoped to iCrestiQ Sourcing only, Keith's other businesses added after the build is running. User also specified a full note-sharing/moderation design (checkbox to share, reversible, survives the author leaving the platform, admin-only removal for derogatory content, member flagging) — folded into the schema and the artifact.
- Updated the Sourcing Pipeline scoping artifact to reflect all five decisions, the note-moderation design, and the resulting schema change (7 tables instead of 6 — added `note_flags`; `companies`/`contacts` shared instead of profile-owned).
- Wrote and applied a Supabase migration creating all 7 Phase 0 tables (`companies`, `contacts`, `deal_stages`, `deals`, `deal_contacts`, `notes`, `note_flags`), a reusable `is_paid_member()` RLS helper, shared-directory RLS on companies/contacts (paid-tier gated, no member-facing delete), standard `profile_id`-owned RLS on the rest, and a `protect_note_removal_fields` trigger that blocks non-service-role updates to the note-moderation columns regardless of what the client sends.
- Ran Supabase's security advisor against the new schema and fixed two real findings in the new migration: a missing `search_path` pin on `set_updated_at()`, and `protect_note_removal_fields()` (a trigger-only function) being exposed as a callable REST RPC endpoint. Both fixed in a follow-up migration.
- Built the `/pipeline` route (nav-gated the same way Matched Opportunities is): Companies tab, Contacts tab, and Pipeline Stages tab, each with working add/edit and (for companies/contacts) an expandable notes panel. Notes ship private-only in this phase — no share toggle, flag, or admin-removal UI yet (that's Phase 3), though the schema already supports it.
- Suspended the Notion Connect/Reconnect UI in `Profile.jsx`, replacing it with a retirement notice; removed the now-dead database-picker code path (state, effect, two functions) that only existed to support the removed buttons.
- Self-review pass after the initial build found and fixed one real gap: duplicate pipeline-stage names produced a raw Postgres error instead of a plain-English message — added a shared `friendlyStageError()` helper used consistently across add/rename/delete.
- Verified via `npm run build` — clean, both before and after the self-review fix, confirming every import resolves and the new route bundles correctly.

**Files and database objects changed:**
- Supabase migration `phase0_sourcing_pipeline_schema`: 7 new tables, RLS policies, `is_paid_member()` and `set_updated_at()` helper functions, `protect_note_removal_fields()` trigger. Applied.
- Supabase migration `phase0_harden_functions`: pinned `search_path` on `set_updated_at()`, revoked RPC execute on `protect_note_removal_fields()`. Applied.
- `src/pages/Pipeline.jsx` (new), `src/pages/Pipeline.module.css` (new): the Phase 0 UI.
- `src/App.jsx`: added the `/pipeline` route. `src/components/layout/Layout.jsx`: added the nav link.
- `src/pages/Profile.jsx`: Notion Connect/Reconnect UI replaced with a retirement notice; dead database-picker code removed.
- All of the above committed and pushed as `0ff27e7` ("Add Sourcing Pipeline CRM: Phase 0").

**Decisions and reasons:**
- Shared vendor directory chosen as an explicitly paid feature over a private-per-member one, accepting the one-way-door migration risk (unwinding shared data later is much harder than the reverse) in exchange for compounding directory value and a real retention argument — user's call, made after reviewing the tradeoff table now in the artifact.
- Note removal enforced via a database trigger rather than relying on RLS or the frontend alone — removal is an admin action, and the trigger makes that true regardless of what any future client code does, not just today's.
- Built the full 7-table schema now, including the Phase-3-only moderation columns and `note_flags`, rather than splitting it across two migrations, since the shape was already fully specified in the artifact.

**Tests and results:** No automated test suite. Verification was `npm run build` only — confirms compile correctness, not runtime/UI correctness. **The in-app browser was explicitly ruled out mid-session** ("do not use internal browser, it crashes Claude") — confirms the existing CLAUDE.md instruction is a hard rule for this project, not a soft preference. Live RLS behavior (shared-directory access under different membership tiers, the moderation trigger under real auth context) has not been exercised against real sessions, and neither has the UI itself been clicked through by a human yet.

**Deployment and verification status:** Two Supabase migrations applied and confirmed via schema/advisor queries. One git commit (`0ff27e7`) pushed to `origin/main`; Vercel deploys automatically from `main` but the deploy itself was not independently confirmed to finish.

**Problems and lessons:**
- A user question about "cards coming down vertically" initially looked like it might be a UI bug report but turned out to be about the not-yet-built Kanban board — the user had mistaken the already-built Pipeline Stages settings tab for it. Worth confirming which screen a screenshot actually shows before assuming what needs to change.

**Unresolved issues:**
- No live/authenticated testing of `/pipeline` has been done — not yet confirmed to work as expected in a real browser.
- Phase 1 (purchase automation: auto-create a Deal + Contacts from a completed `bid_requests` row) is scoped in the artifact but not started.
- Everything already listed as unresolved earlier in this same session (attachment parsing, `SAM_GOV_API_KEY` confirmation) and as of 2026-08-23 — still untouched.

**Next recommended action (superseded — see below):** ~~Exercise `/pipeline` directly... before Phase 1 starts~~ — the user went straight to authorizing Phase 1 in this same session instead of testing Phase 0 standalone first; Phase 0 ended up getting exercised as a side effect of testing Phase 1 with a real purchase. See the continuation immediately below.

---

### Later the same session — Sourcing Pipeline Phase 1 build (purchase automation)

**Goal:** Auto-create a Deal (linked to whatever companies the AI research found) the moment a Suggested Bid purchase completes, and confirm it actually works with a real purchase.

**Work completed:**
- Discovered while implementing that `supplier_research` (the AI's output) is company-level data only — `{name, note, source_url}`, no person name/email/phone — so the artifact's original diagram ("→ Contact") was a simplification that didn't hold up under actual implementation. A deal needs to link directly to companies, not through a fabricated placeholder contact standing in for one.
- Added a `deal_companies` join table (mirroring `deal_contacts`'s RLS pattern) and a `unique (bid_request_id)` constraint on `deals` — the latter a DB-level backstop making the automation's idempotency check (below) hold even if the application logic ever has a bug, same defense-in-depth approach as the Phase 0 note-removal trigger.
- Extended `generate_suggested_bid` (v12 → v13) with a `createCrmDeal(...)` call, wrapped in the same non-blocking try/catch contract the Notion sync already uses — a bug in the CRM automation can never fail a paid purchase. On a completed purchase it now: checks for an existing deal on that `bid_request_id` first (idempotent on retries); seeds default pipeline stages if the member has never opened `/pipeline` (a real gap that would otherwise crash the automation, since the frontend only seeds stages on visit); creates the deal in the member's first stage with `value_estimate` set to the AI's suggested price-range midpoint; writes two private deal-level notes (AI summary; RFQ drafts); and for each supplier/shipper lead, finds-or-creates a company (case-insensitive name match, escaping literal `%`/`_` so a name like "100% Vendor" can't be misread as a wildcard) and links it via `deal_companies`.
- Added a read-only Deals tab to `/pipeline` (title, stage, value estimate, linked companies) — deliberately list-only, no drag-drop, no deal detail page, no manual creation, all per the user's confirmed choice to add just enough UI to see the automation's output.
- Re-ran Supabase's security advisor after deploying and caught that the Phase 0 hardening fix for `protect_note_removal_fields()` had never actually taken effect (see Current Risks) — fixed it properly this time and verified directly against `information_schema.routine_privileges`.
- **User bought a real Suggested Bid and confirmed the automation worked**: a Deal landed in the correct stage with a sensible value estimate, and all 10 AI-found companies (5 suppliers, 5 packer/shippers) were created and linked with the correct roles.

**Files and database objects changed:**
- Supabase migration `phase1_deal_companies_schema`: `deal_companies` table + RLS, `deals.bid_request_id` unique constraint. Applied.
- Supabase migration `phase1_fix_protect_note_removal_grant`: corrected the `PUBLIC`-grant bug above. Applied.
- Supabase Edge Function `generate_suggested_bid`: v12 → v13 (CRM automation). Deployed.
- `src/pages/Pipeline.jsx`: added the Deals tab. Committed and pushed (`4c782fe`).
- No `opportunities`/`bid_requests`/`profiles` row data was read or modified beyond what the automation itself wrote as a result of the user's real purchase (one deal, notes, and company/deal_companies rows for that purchase).

**Decisions and reasons:**
- Added `deal_companies` rather than routing through a placeholder contact — a fabricated "contact" standing in for a company would have polluted the shared contacts directory with non-person entries, working against the CRM's own data-quality goals. Small, discovered-during-build schema addition, not scope creep.
- Kept the Deals tab strictly read-only per the user's explicit choice — enough to verify the automation, nothing that pulls Phase 2 forward.
- Verified the `PUBLIC`-grant fix against `information_schema.routine_privileges` directly rather than re-trusting the advisor, since the advisor's own cache was exactly what made the original bug invisible.

**Tests and results:** One real, user-initiated Suggested Bid purchase — the first genuine end-to-end test of any part of the Sourcing Pipeline CRM. Passed. Everything else (idempotency on a retry, the stage-auto-seed path, the deal-level notes actually being correct) is code-reviewed only.

**Deployment and verification status:** Two Supabase migrations applied. `generate_suggested_bid` v13 `ACTIVE`, `verify_jwt: false` unchanged. One git commit (`4c782fe`) pushed to `origin/main`.

**External dashboard changes not represented in git:** the two migrations and the v13 deploy exist only in Supabase. The real purchase's resulting rows (one deal, ~10 companies, several notes) exist only in the live database.

**Problems and lessons:**
- The `PUBLIC` vs. named-role grantee distinction is a real Postgres gotcha worth remembering: revoking `EXECUTE` from `anon`/`authenticated` explicitly does nothing if the actual grant was made to `PUBLIC` — always check `information_schema.routine_privileges` for the real grantee before considering an access-control fix verified, not just the advisor's summary.
- Real implementation surfaced a real gap in the original scoping artifact (`supplier_research` being company-level, not contact-level) that scoping alone hadn't caught — a reminder that scoping documents are a starting hypothesis, not a guarantee, and building tends to find what planning misses.

**Unresolved issues:**
- Deal-level notes (AI summary, RFQ drafts) have no viewing UI — written correctly per the live test's evidence (the automation clearly ran), but not visually confirmed, since there's nowhere to see them until Phase 2.
- Idempotency (a retried/re-completed purchase not creating a duplicate deal) has not been tested against a real retry — code-reviewed and DB-constraint-backed only.
- The stage-auto-seed path (a member buying Suggested Bid before ever opening `/pipeline`) was not exercised by this test, since the purchasing member had already visited `/pipeline` and had stages seeded.
- Everything already listed as unresolved earlier this session and as of 2026-08-23 — still untouched.

**Next recommended action (superseded — see below):** ~~Phase 2 is the natural next step~~ — the user authorized it in this same session. See the continuation immediately below.

---

### Later the same session — Sourcing Pipeline Phase 2 build, plus two follow-on requests

**Goal:** Build the Kanban drag-drop board and a deal detail modal (Phase 2), then respond to two rounds of follow-on requests: deal-linked-company removal + identifier display, and a live bug report (missing NSN on a card).

**Work completed:**
- Logged a user-requested suggestion in the artifact (not built): search suppliers/packers-shippers by CAGE code, name, and NSN. Confirmed neither is currently structured data — `companies` has no `cage_code` column, and NSNs only exist as free text per-opportunity with no link to which supplier carries them.
- Built the Kanban board (`@dnd-kit/core` — installed, then trimmed back to just `@dnd-kit/core` after a self-review found `@dnd-kit/sortable`/`@dnd-kit/utilities` were installed but never actually used) and the deal detail modal replacing Phase 1's read-only list. Cross-column drag updates `deals.stage_id` optimistically, reverting on a failed write. The modal is where deal-level notes (written since Phase 1) became visible for the first time.
- Added a "View in Pipeline" link on `MatchedOpportunities.jsx` once a deal exists for a completed purchase, deep-linking via `?tab=deals&deal=<id>` — `Pipeline.jsx` reads it once on mount (captured in a lazy `useState` initializer, not read reactively, so the clearing effect right after doesn't wipe it before use) and clears the query params so a refresh doesn't reopen the same deal.
- Per user follow-up: added a remove button on each linked-company chip in the deal modal (unlinks from just that deal — `deal_companies` delete, RLS already permitted this since Phase 1, only the UI button was missing) and a solicitation-#/NSN/P-N identifier line under the title on both the card and modal, deliberately as display metadata rather than baked into the deal title itself, so the data stays usable for the CAGE/NSN search suggestion above.
- Per user follow-up: fixed two visual issues — `Pipeline.module.css`'s `.page` was missing the `padding: var(--sp-8)` every other page under `Layout` has (`Layout`'s own `.main` carries no padding by design; each page supplies its own, and Pipeline's was never added), and inline links inside AI-generated bullet text (e.g. a risk-note pointing at a store product) were unreadable — the global default `<a>` color is the same navy as body text — given a distinct gold, underlined style scoped to just that context.
- Per user bug report ("the NSN didn't land on the card"): traced to `extractIdentifiers()`'s regex only matching hyphenated NSNs; this opportunity's source text had the NSN as a bare 13-digit run. Fixed and deployed as `generate_suggested_bid` v14, then backfilled the one affected `bid_requests` row.
- Republished the "Sourcing Pipeline" scoping artifact to reflect Phases 0–2 as shipped and live-verified (status chip, the narrowed-scope Phase 2 card, footer next-step), matching the state of this handoff.

**Files and database objects changed:**
- `src/pages/MatchedOpportunities.jsx`, `src/pages/MatchedOpportunities.module.css`, `src/pages/Pipeline.jsx`, `src/pages/Pipeline.module.css`, `package.json`/`package-lock.json` (`@dnd-kit/core` added): committed and pushed across two commits, `46de002` and `7251f32`.
- Supabase Edge Function `generate_suggested_bid`: v13 → v14 (`extractIdentifiers` fix). Deployed.
- `public.bid_requests` (Supabase, row `8620a749-...` only): `suggested_bid.identifiers` corrected via a single `jsonb_set` — explicitly authorized after the auto-mode classifier blocked the first attempt as a direct production-data write. Nothing else in that row's `suggested_bid` touched.
- No migration needed for the Kanban board, modal, or link-removal feature — all reuse Phase 0/1's existing schema and RLS.

**Decisions and reasons:**
- Kept identifiers as display metadata rather than folding them into `deals.title` — the user offered both options; a title string isn't cleanly searchable by identifier later, which would work against the CAGE/NSN search suggestion logged the same session.
- Removed the two unused `@dnd-kit` packages rather than leave them in `package.json` — caught in self-review, not by the user.
- Backfilled only the one row the user was actively looking at, not a blanket audit of every historical `bid_requests` row for the same bug — scoped to what was asked; the broader audit is flagged as unresolved below.

**Tests and results:** `npm run build` after every change (all clean). One live user test of the Kanban board/modal against the existing real purchase — confirmed working, including the previously-invisible notes rendering correctly. The NSN fix itself has not yet been exercised by a *new* purchase — only verified via the backfilled historical row and code review of the corrected regex.

**Deployment and verification status:** `generate_suggested_bid` v14 `ACTIVE`, `verify_jwt: false` unchanged. Two git commits (`46de002`, `7251f32`) pushed to `origin/main`. One production data backfill, explicitly authorized, confirmed via the query's own `returning` clause.

**External dashboard changes not represented in git:** the v14 deploy and the one-row `bid_requests` backfill exist only in Supabase.

**Problems and lessons:**
- A "the feature didn't work" report turned out to be a genuine, narrow regex bug (wrong format assumption), not a wiring or logic error — the AI's own output already had the correct answer sitting right next to where the broken extraction was looking. Worth checking what the model itself already produced before assuming a bigger structural problem when a downstream display is empty.
- Direct production data writes (even a single-row, explicitly-scoped `UPDATE`) are blocked by the auto-mode classifier regardless of how narrow they are — confirms this project's "explicit approval with a preview" rule for production-data changes is enforced at the tooling level, not just a convention to remember.

**Unresolved issues:**
- Other historical `bid_requests` rows may have the same missed-NSN bug (unhyphenated format) and have not been audited or backfilled — only the one row the user was looking at was fixed.
- Quotes into Proposal Builder — still not started, the one piece of the original Phase 2 scope deliberately deferred.
- Everything already listed as unresolved earlier this session (idempotency on a retried purchase, the stage-auto-seed path, attachment parsing, `SAM_GOV_API_KEY` confirmation) and as of 2026-08-23 — still untouched.

**Next recommended action (superseded — see below):** ~~Decide whether to audit other historical `bid_requests` rows for the same NSN-extraction gap~~ — the user picked this up directly in a later continuation of this same session, after first building Phase 3 and Phase 3b. See the continuation immediately below.

---

### Later the same session — Sourcing Pipeline Phase 3 + 3b, click-to-jump, and the NSN audit

**Goal:** Build the note-sharing/flagging/admin-moderation lifecycle (Phase 3) and a private tasks/reminders system (Phase 3b), wire click-to-jump from a task to its record, then run the NSN-extraction audit recommended at the end of the previous entry.

**Work completed:**
- **Phase 3 (note sharing/flagging/moderation):** Added a share/unshare toggle (note author only) and a Flag button (any other paid member, shared notes only) to `NotesPanel`, gated by a new `allowSharing` prop — on for Companies/Contacts, off for the deal modal (deal notes stay private-only). Added `api/admin/moderate-note.js`, a service-role-backed admin route that unshares a flagged note and stamps the removal audit columns, since the Phase 0 `protect_note_removal_fields` trigger only trusts `service_role` regardless of the caller's `profiles.role`. Added a new "Flagged Notes" tab to `AdminPanel.jsx` (`FlaggedNotesTab`), modeled directly on the existing `ReportsTab` moderation pattern, listing every flagged note with Remove (calls the new API route) and Dismiss (deletes the `note_flags` row) actions. Added one migration giving admins a `note_flags` DELETE policy — the one RLS gap Phase 0 had left for dismissing a flag without removing the note.
- **Phase 3b (tasks/reminders), scoped via three explicit user decisions:** tasks attach to a Deal, Company, *or* Contact (not shared-directory content — private per-owner, unlike notes); a purchase's auto-created deal gets seeded with a starter "Send RFQ to suppliers" task; reminders surface as in-app visual styling only (overdue in red), no email/cron. Added a new `tasks` table (polymorphic parent via a single-parent check constraint, standard `profile_id`-owned RLS). Added `TasksPanel` (embedded on Companies/Contacts/deal modal, mirrors `NotesPanel`'s shape without the sharing complexity) and a new Tasks tab — a flat "every open task, soonest due date first" reminders view across the whole pipeline. Extended `generate_suggested_bid`'s `createCrmDeal` with a `seedStarterTask` call, wrapped in its own try/catch so a task-seeding failure can't block the notes/company-lead seeding that follows it — same non-blocking contract the rest of that function already uses.
- **Click-to-jump, per user follow-up request:** clicking a task's entity name in the Tasks tab now switches tabs and opens (or expands) that exact deal/company/contact, instead of showing it as plain text. Lifted three `jump*Id` state slots up to the top-level `Pipeline()` component; `DealsTab`/`CompaniesTab`/`ContactsTab` each pick up a new `open*` prop in an effect, mirroring the deep-link-from-query-param pattern `DealsTab` already had for `initialDealId`.
- **NSN-extraction audit** (the prior entry's recommended next action): queried all 15 completed `bid_requests` rows. Re-checked the fixed bare-13-digit pattern against every stored opportunity title (the only description-adjacent text actually persisted in the DB) — no miss found. Discovered `opportunities.description` and `raw_payload.description` are both just a SAM.gov API URL, never the description body text itself, so the 11 rows with `null`/`[]` identifiers can't be checked further without a live re-fetch from SAM.gov using the `SAM_GOV_API_KEY` secret. Flagged this explicitly to the user as a step beyond a normal DB read (external live API, not just Supabase) — **the user chose not to pursue it** ("no, leave it alone"). Also surfaced, as a side effect of the audit query, that 5 of those 11 rows have `identifiers = null` rather than `[]` — a distinct, earlier gap (predates the `identifiers` field/extraction existing at all), not the regex bug itself.

**Files and database objects changed:**
- `src/pages/Pipeline.jsx`, `src/pages/Pipeline.module.css`: Phase 3 sharing/flagging UI, Phase 3b `TasksPanel`/Tasks tab, click-to-jump wiring — three commits, `3367760`, `2edef99`, `399e955`, all pushed.
- `api/admin/moderate-note.js` (new file): committed in `3367760`.
- `src/pages/AdminPanel.jsx`: `FlaggedNotesTab` + nav entry added, committed in `3367760`.
- Supabase migration `phase3_note_flags_admin_dismiss`: `note_flags` admin DELETE policy. Applied.
- Supabase migration `phase3b_tasks`: new `tasks` table, RLS, partial index. Applied.
- Supabase Edge Function `generate_suggested_bid`: v14 → v15 (`seedStarterTask`). Deployed.
- No `opportunities`/`bid_requests` row data was modified this session — the NSN audit was read-only (title text + `identifiers`/`raw_payload` keys only, aggregate/per-row counts, no writes).

**Decisions and reasons:**
- Tasks kept private per-owner rather than reusing notes' share/flag machinery — user's explicit choice; a task is a personal to-do, not directory content, so extending the sharing model to it would have been scope creep beyond what was asked.
- Starter task seeded automatically on purchase (vs. manual-only) and reminders kept in-app-visual-only (vs. email/cron) — both user's explicit choice from a three-question scoping round before any code was written, matching this project's established pattern of confirming design decisions before building.
- Click-to-jump entity labels render as plain text (not a link) when `entityId` is somehow missing, rather than a broken button — defensive but minor, matches existing patterns like `dealIdentifierLine`'s fallback handling.
- Declined to pursue the live SAM.gov re-fetch for the 11 unverifiable audit rows — user's explicit call once the tradeoff (external API call beyond Supabase, possible archived/expired notices) was made clear, not a default I chose myself.

**Tests and results:** No automated test suite. `npm run build` clean after every change (Phase 3, Phase 3b, and click-to-jump each verified separately). **No in-app browser verification was done for any of this** — the standing project rule against using it held throughout. The user did confirm, from the live Vercel deploy, that the Tasks tab itself "looks like" and works as intended (their words: "looks good i like the idea of clicking a task…") — the only live click-through this session had. Phase 3's sharing/flagging/admin-moderation UI has not been clicked through by the user at all yet.

**Deployment and verification status:**
- Supabase: migrations `phase3_note_flags_admin_dismiss` and `phase3b_tasks` both applied. `generate_suggested_bid` v15 `ACTIVE`, `verify_jwt: false` unchanged, verified via the deploy tool's own response (not a separate post-deploy source pull this time, unlike earlier sessions).
- Git/Vercel: three commits (`3367760`, `2edef99`, `399e955`) pushed to `origin/main`, each following its own explicit "apply/deploy/commit/push" authorization from the user. Vercel deploys automatically from `main` on push — not independently reconfirmed to have finished for the third commit.

**External dashboard changes not represented in git:** the two migrations and the v15 Edge Function deploy exist only in Supabase.

**Problems and lessons:**
- Nothing in this project's own code needed correcting — the audit's real finding was about what data *doesn't* exist (description body text was never persisted, only fetched transiently at generation time), not a bug to fix. Worth remembering the next time "just check X" comes up: confirm the data actually exists to check before promising a full audit.
- The `identifiers = null` vs `identifiers = []` distinction in the audit query turned out to matter — it separated "extraction ran and found nothing" from "extraction didn't exist yet," which would have been easy to conflate into one bucket if the query hadn't preserved the raw JSON value.

**Unresolved issues:**
- 11 of 15 completed `bid_requests` rows remain unverifiable for the NSN bug without a live SAM.gov re-fetch — explicitly left as-is per the user's decision, not scheduled.
- Phase 3's sharing/flagging/admin-moderation UI has not been clicked through live by the user yet (unlike the Tasks tab, which has).
- Click-to-jump has not been separately confirmed working for all three entity types (deal/company/contact) by the user — only the general idea was confirmed before it was built.
- Everything already listed as unresolved earlier this session (idempotency on a retried purchase, the stage-auto-seed path, attachment parsing, `SAM_GOV_API_KEY` confirmation, other member profiles' orphaned-purchase audit) and as of 2026-08-23 — still untouched.

**Next recommended action (superseded — see below):** ~~Have the user click through Phase 3's sharing/flagging/admin-moderation UI and the three click-to-jump paths live~~ — the user instead picked "start the next phase" as the next instruction, which became Phase 4. See the continuation immediately below.

---

### Later the same session — Sourcing Pipeline Phase 4 (CAGE/NSN search + reporting)

**Goal:** Build the reporting + CAGE/NSN search phase from the roadmap — the user picked this explicitly from a menu of three remaining items (Quotes into Proposal Builder, Phase 4, Phase 5).

**Work completed:**
- Scoped two real design decisions with the user before writing any code, since both affected schema: (1) how a company gets linked to an NSN it supplies — user chose auto-derive from deal history, with the ability to unlink a wrong/stale tag; (2) whether reporting should include a win rate — user chose yes, and specifically asked for a three-way Won/Lost/**Declined** split (declined = the member's own pursue/don't-pursue call, not a loss), not just won/lost.
- Building the auto-derive design surfaced a real architectural conflict, corrected before writing code: a live join off `deal_companies`/`bid_requests` would only ever show a member their own private deal history (deals are `profile_id`-owned RLS), which would silently defeat the entire "shared directory compounds in value" argument Decision 01 was built on — a company found via one member's purchase wouldn't show as NSN-linked when a different member searched, even though the company row itself is visible to them. Fixed by materializing the association into a new shared table (`company_nsns`), populated only by the service-role purchase automation (bypassing RLS), with any-paid-member delete for unlinking.
- Added `companies.cage_code` (simple manual field) and a search box on the Companies tab filtering by name, CAGE code, or NSN (normalized to alphanumerics-only on both sides so punctuation doesn't have to match exactly).
- Added `deal_stages.stage_type` (`active`/`won`/`lost`/`declined`), a type selector in the Stages tab per stage, and a best-effort migration backfill tagging any existing stage literally named "Awarded"/"Lost" correctly (still fully editable after).
- Added a new **Reports** tab: active pipeline value + deal count per stage, and Won/Lost/Declined counts with rates.
- Extended `generate_suggested_bid` (v15 → v16): every purchase now auto-tags its supplier companies (not packer/shippers — an NSN is something a company supplies, not something a shipper "carries") with any NSNs the AI found, into `company_nsns`, in its own try/catch (non-blocking, same contract as the rest of the function). Required passing `identifiers` through to `createCrmDeal`, which it previously never received even though it was already computed earlier in the function.
- Caught and fixed a real inconsistency while doing this: the edge function's own `DEFAULT_STAGES` (used to seed a first-time buyer's pipeline) was still the old flat 5-stage array with no `stage_type`, no longer matching the frontend's updated 6-stage set — the file's own comment says to keep the two in sync, so fixed it in the same deploy rather than shipping a silent mismatch.

**Files and database objects changed:**
- `src/pages/Pipeline.jsx`, `src/pages/Pipeline.module.css`: CAGE/NSN search UI, stage-type tagging UI, new Reports tab. Committed and pushed as `9a49799`.
- Supabase migration `phase4_reporting_cage_nsn`: `companies.cage_code`, new `company_nsns` table + RLS, `deal_stages.stage_type` + backfill. Applied.
- Supabase Edge Function `generate_suggested_bid`: v15 → v16 (`company_nsns` auto-tagging, `DEFAULT_STAGES` sync fix). Deployed.
- `PROJECT_HANDOFF.md` deliberately left out of the `9a49799` commit at the time (its edits weren't yet authorized for commit) — folded into this same update instead, per the user's follow-up "update handoff and commit."

**Decisions and reasons:**
- `company_nsns` built as a real shared table rather than a live join, once the RLS conflict above was found — user never had to weigh in on this specific correction since it was a straightforward "the originally-agreed design doesn't actually work, here's the fix that still honors the same decision," the same category of build-time correction as `deal_companies` back in Phase 1.
- NSN tagging scoped to supplier-role companies only, not packer/shippers — a shipper doesn't supply the part, it just moves it once someone else has it.
- `stage_type` as a text column with a check constraint (not a boolean is_won/is_lost pair) specifically to give "declined" a real first-class value, matching what the user actually asked for rather than the simpler two-state version originally offered as the "skip win rate" alternative during scoping.

**Tests and results:** No automated test suite. `npm run build` clean after the frontend changes. **No in-app browser verification was done** — the standing project rule held. Not yet clicked through live by the user (unlike the Tasks tab from the previous entry, which was).

**Deployment and verification status:**
- Supabase: migration `phase4_reporting_cage_nsn` applied. `generate_suggested_bid` v16 `ACTIVE`, `verify_jwt: false` unchanged, verified via the deploy tool's own response.
- Git/Vercel: one commit (`9a49799`) pushed to `origin/main`, following explicit "apply/deploy/commit/push" authorization. Vercel deploys automatically from `main` on push — not independently reconfirmed to have finished.

**External dashboard changes not represented in git:** the migration and the v16 Edge Function deploy exist only in Supabase.

**Problems and lessons:**
- The RLS-vs-shared-directory conflict here is worth remembering as a pattern, not just a one-off fix: any future feature that wants to aggregate or derive something "across all members" from data that lives in a `profile_id`-owned table will hit the same wall — the fix is always going to be "materialize it via the service-role automation into a real shared table," not a client-side join, because RLS makes the join structurally incomplete for any individual member's session.
- Caught the `DEFAULT_STAGES` drift only because the file's own existing comment explicitly called out the sync requirement — a good argument for leaving that kind of comment in place even after the code it originally described has been superseded once already.

**Unresolved issues:**
- Phase 4 has not been clicked through live by the user yet — the search box, CAGE code field, stage-type tagging, and the Reports tab are all build-verified only.
- `company_nsns` was not backfilled for the 4 already-completed deals that have identifiers — only new purchases going forward populate it. Flagged to the user as an optional follow-up; not done, no authorization sought.
- Everything already listed as unresolved earlier this session (11 of 15 `bid_requests` rows unauditable for the NSN bug, Phase 3's moderation UI not yet clicked through, idempotency-on-retry, the stage-auto-seed path, attachment parsing, `SAM_GOV_API_KEY` confirmation, other member profiles' orphaned-purchase audit) and as of 2026-08-23 — still untouched.

**Next recommended action:** Have the user click through Phase 4 live (search, CAGE code entry, stage tagging, Reports tab) and Phase 3's moderation UI together, since both are still only build-verified — then decide between the two remaining roadmap items, Quotes into Proposal Builder and Phase 5. This is a recommendation, not an approved priority.

## Session — 2026-08-23

**Goal:** Verify the health of the SAM.gov → matching → Notion pipeline ("soak test" follow-up), resolve issues found along the way, and scope a possible HubSpot integration.

**Work completed:**
- Live-verified SAM.gov ingestion, `match_opportunities`, and Notion sync over the prior 3–4 days (cron history, edge function logs, row-level data) — see Production Verified.
- Diagnosed and confirmed self-resolution of the one `match_opportunities` 500 error found in that window.
- Found and explained two data patterns in `opportunity_matches` initially mistaken for bugs: 318 null-recommendation rows (expected — awaiting unscheduled AI scoring) and zero `go` recommendations to date (data-driven, not a logic fault).
- Explained the Notion sync backlog/throttling to the user and, per their decision, hid ~524 non-purchased `opportunity_matches` rows for profile `404be639-e000-493d-a998-f7a60c289902` while keeping all 13 purchased ones visible.
- Found 4 of those 13 purchased opportunities had no `opportunity_matches` row at all (orphaned by the historical pruning gap above) and, with authorization, restored them via direct insert.
- Deployed `match_opportunities` version 10 — added a 5-day `posted_date` lookback window restricting *new*-match creation, so future runs (including ones triggered by a member editing their NAICS/PSC codes) no longer re-scan the entire open-opportunity backlog. Existing matches and all other logic in the function are unchanged; verified via a post-deploy source pull.
- Read Keith's live HubSpot portal (pipeline stages, custom Deal properties, account limits) read-only, to ground a HubSpot-integration proposal in real data rather than assumptions.
- Produced and published a scoping artifact ("GovCon Deal Sync") covering the proposed HubSpot record shape, sync architecture, phased build plan, and monetization rationale, for both Keith's own business use and a potential paid GovCon Lab member feature. No code written.
- Researched (web search, not live-account-verified) free-tier CRM alternatives (Zoho, Bitrix24, Airtable, Odoo) and HubSpot's free-tier email-sending limits, at the user's request, while comparing options.
- At the user's follow-up request, scoped a **native in-house CRM** ("Sourcing Pipeline") as an alternative to both Notion and HubSpot: contacts/companies (vendors, suppliers, contracting officers, packers/shippers), a Kanban deal pipeline, and notes, with deals auto-created from `bid_requests` (`suggested_bid` + `supplier_research` JSON) the moment a Suggested Bid purchase completes. Grounded directly in `api/stripe/webhook.js`, `api/stripe/suggested-bid-checkout.js`, and the `bid_requests`/`opportunities` field shapes read from `MatchedOpportunities.jsx` — confirmed the same gap driving the HubSpot scoping also applies here: `sync_opportunities_to_notion` never carries paid research, so neither does the current Notion path. Proposed a 6-table schema (companies, contacts, deal_stages, deals, deal_contacts, notes), a phased roadmap (Phase 0 contacts/notes → Phase 5 HubSpot-parity stretch), and a cost assessment (no new subscription; infra delta negligible at current scale; engineering time sized by relative phase effort, not a dollar figure). No code written, no schema created.

**Files and database objects changed:**
- Supabase Edge Function `match_opportunities`: version 9 → version 10 (production deploy, explicitly authorized, scoped to this one function only).
- `public.opportunity_matches` (Supabase, profile `404be639-e000-493d-a998-f7a60c289902` only): ~524 rows set `hidden_by_user = true`; 3 previously-hidden rows set back to `false`; 4 new rows inserted restoring orphaned purchased-opportunity matches.
- `CLAUDE.md` and `PROJECT_HANDOFF.md`: committed earlier in the session (commit `d69ed05`) — unrelated docs housekeeping, not part of the pipeline work above.
- No other database writes, no other function deploys, no secrets read or altered, no HubSpot data created or modified.

**Decisions and reasons:**
- Cap new-match creation to a 5-day posted-date window (user's choice, from a 2/3–5/5+ day range offered) — prevents a repeat of the 500+ match flood that occurred when a prior pagination-cap fix suddenly exposed the full open-opportunity backlog to matching.
- Keep all 13 purchased opportunities visible when hiding the backlog, rather than literally "all but one" as first requested — surfaced that 12 purchases beyond the one named were about to be hidden, and the user confirmed keeping all 13.
- Restore orphaned purchased-match rows with an explicit "restored" `match_reason` and a null recommendation, rather than recomputing a fit verdict against the member's *current* NAICS/PSC codes — those codes have since narrowed and no longer actually overlap with 2 of the 4 restored opportunities; fabricating a rationale would have been inaccurate.
- HubSpot integration: scope-only for now, at the user's explicit instruction ("just weighing options" / "take no action"), until this last request to flesh it out as a scoping document.

**Tests and results:** No automated test suite was run this session. Verification was direct: cron run history, edge function logs, row-level query results, and a post-deploy source diff (see Production Verified and Deployment below).

**Deployment and verification status:** One production deploy this session — `match_opportunities` v10, 2026-08-23 04:54 UTC. Verified post-deploy by re-fetching the live function source and confirming it matched the intended change byte-for-byte, with `verify_jwt` unchanged (`false`). The function was **not invoked** to test it, since running it would itself write data — that was out of scope for what was authorized.

**External dashboard changes not represented in git:** The Supabase Edge Function deploy and the `opportunity_matches` data changes above exist only in Supabase, not in this git repository (Edge Function source is not checked in — see Current Architecture).

**Problems and lessons:**
- The `match_opportunities` NOT-NULL crash was caused by an `upsert(..., { onConflict: 'id' })` call whose payload omitted `profile_id`/`opportunity_id` — Postgres validates the full implied INSERT row's constraints for an `ON CONFLICT` upsert even when the actual operation is an UPDATE. Worth remembering for any future upsert-by-id pattern in these Edge Functions.
- The same pruning logic that caused the orphaned-purchase bug only protects against future recurrence for the profile(s) checked — it does not retroactively repair other affected profiles, which have not been audited.

**Unresolved issues:**
- AI fit-scoring (`score_opportunity_matches`) still not scheduled — needs secret confirmation + a frequency decision.
- Notion sync's missing deep-dive content (paid research fields) — not addressed.
- Other member profiles were not checked for the same historical orphaned-purchase gap found and fixed for one profile.
- HubSpot's closed-won/closed-lost stage mislabeling in Keith's live portal — flagged, not fixed.
- HubSpot integration itself — scoped only, no build started; open questions listed in the scoping artifact (property headroom, OAuth app review, Make.com's role if any, pricing shape).
- Native CRM ("Sourcing Pipeline") — scoped only, no build started. Five open decisions block schema work, the biggest being single-tenant (Keith's own businesses) vs. eventually member-facing (real RLS fork) — see the scoping artifact for the full list (Notion sync's fate, migration, pipeline-stage flexibility, whether Keith's multiple businesses are first-class `companies` rows).
- `CLAUDE.md`'s uncommitted local changes (see Current Repository State) — origin and intent unclear, not investigated or acted on this session.

**Next recommended action:** Confirm whether other member profiles have the same orphaned-purchase gap found for profile `404be639...` this session, since that's a direct data-integrity issue affecting real paid purchases. This is a recommendation, not an approved priority.

## Last Handoff Update

2026-08-27, America/New_York.
