# iCrestiQ GovCon Lab — Project Handoff

## Project Identity

React (Vite) SPA for govconlab.com — membership, community, and tooling platform for a small AI-assisted government-contracting business. Backend: Vercel serverless functions + Supabase (Postgres/Auth). Payments: Stripe. Repository: `C:\Users\Katki\icrestiq-govcon-lab`.

## Current Repository State

- **Branch:** `main`, confirmed in sync with `origin/main` this session.
- **Latest commit:** `4c782fe` — "Add read-only Deals tab: Sourcing Pipeline Phase 1" — pushed 2026-08-24. Preceded the same day by `2405d1a` (handoff), `0ff27e7` (CRM Phase 0), `744199b` (webhook price-map fix), and `a499b79` (Founding pricing).
- **Uncommitted working-tree state:** only `.claude/`, untracked, not touched this session.

## Current Architecture

- Frontend: React 18 + Vite 5, client-rendered SPA, React Router v6, CSS Modules, route-level code splitting.
- Backend: Vercel serverless functions (Node, ESM) under `api/`, grouped by domain (`admin/`, `convertkit/`, `digest/`, `notion/`, `proposal/`, `quiz/`, `slack/`, `stripe/`, `upload/`, `_lib/`). Data-pipeline logic (SAM.gov ingestion, opportunity matching, AI fit-scoring, Notion push, expired-match purge) lives in **Supabase Edge Functions**, not in this repo — `sam_gov_ingest`, `match_opportunities`, `score_opportunity_matches`, `sync_opportunities_to_notion`, `purge_expired_matches`, `monthly_rewards`. Their source was pulled and read directly from Supabase this session (not checked into git).
- Database/Auth: Supabase Postgres + Auth. All inspected tables RLS-enabled.
- Payments: Stripe. Membership checkout reads `stripe_price_id` dynamically from Supabase's `products` table rather than hardcoding it in frontend code.
- Email: Gmail SMTP via `nodemailer` for app-originated transactional mail; Supabase's own Auth mailer separately handles account confirmation/password-reset mail.
- Scheduling: Vercel Cron (`vercel.json`, 2 jobs — digest reminders every 5 min, stale-quote alert daily) + Supabase `pg_cron` (5 active jobs, confirmed live 2026-08-23: SAM.gov ingestion daily 11:00 UTC, opportunity matching daily 11:30 UTC, Notion sync push daily 11:45 UTC, expired-match purge weekly Sunday 08:00 UTC, monthly rewards monthly. **`score_opportunity_matches` (AI fit-scoring) remains built but unscheduled** — confirmed again this session).
- External systems referenced in code: Notion API (OAuth), Slack (incoming webhook), Kit/ConvertKit API, SAM.gov (ingestion source). HubSpot is **not** integrated into this repo — a live HubSpot portal exists under Keith's own account (separate from this codebase) and was explored read-only this session for a proposed future integration; see Unresolved Issues below.

## Implemented in Current Code

Membership/auth (Login, Register, Password Reset, email-confirmation flow, Turnstile bot protection) · Community chat · Blog (Supabase-backed, bot-visible Edge Middleware, dynamic sitemap) · Store + Stripe Checkout + Proposal Builder (PDF and Word/.docx export) · Matched Opportunities (SAM.gov ingestion, tier-gated; as of 2026-08-23 new-match creation is capped to opportunities posted in the last 5 days — see Decisions below) · Suggested Bid (paid AI research add-on, **$2/opportunity for both Lab Member and Founding as of 2026-08-24** — Founding's differentiator is now search depth, 8 vs. 5, not price; RFQ email drafts use the opportunity's real delivery destination when SAM.gov provides one, as of the same date) · `/go` lead-qualification quiz · Dashboard learning-path quiz · Admin panel with Site Analytics tab · Weekly digest signup with double opt-in, bot protections, and automated reminder waves · **Sourcing Pipeline CRM, Phases 0–1** (`/pipeline`, shipped 2026-08-24, **live-verified with a real purchase**) — shared Companies/Contacts directory across all paid members, private per-profile Pipeline Stages (customizable from day one), private notes (sharing/flagging/moderation UI not yet built — schema is ready, see Session below). As of Phase 1, `generate_suggested_bid` auto-creates a Deal (linked to whatever companies its research found, via the new `deal_companies` table) the moment a Suggested Bid purchase completes; a read-only Deals tab shows the result. Deal-level notes (AI summary + RFQ drafts) are written by the automation but have no viewing UI yet — Companies' notes are visible today, Deals' are not, until the Phase 2 deal detail page. No Kanban board or manual deal creation yet. · Notion Sync tab now shows a retirement notice only — Connect/Reconnect actions removed as of 2026-08-24; the sync primitive itself (OAuth, `sync_opportunities_to_notion`, `generate_suggested_bid`'s `syncToNotion` calls) is untouched code-wise, just no longer reachable from new UI (see Partially Implemented) · Stale-quote follow-up alert (single-tenant).

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

**No independently-available production-test evidence exists for any other feature** (bot protections, digest email delivery, NAICS selector, Word/PDF export correctness, auth-confirmation flow, stale-quote alert delivery, etc.) — code-confirmed only.

## Partially Implemented

- Sourcing Research → Notion content-field write-back was historically reported as completed and smoke-tested, but its source is not stored in this repository and was not independently re-verified. Six Bid/No-Go gate fields remain reported as unwired.
- **Notion sync carries only listing metadata, never purchased research.** Confirmed by reading `sync_opportunities_to_notion` directly: it maps 8 fields (title, solicitation #, agency, NAICS/PSC, set-aside, source, due date, SAM.gov link) from the `opportunities` table only. It never joins `bid_requests`, so a member's paid Suggested Bid results (price range, technical approach, risk notes, supplier leads, RFQ drafts) never reach Notion even after a successful sync. This is a scope gap in the current implementation, not a bug or a backlog delay.
- Managed Data Feed (recurring re-check + Compliance sync + Stripe pause/resume): no corresponding code found.
- SAM.gov → Notion backfill completeness: not determinable from code alone.

## Planned or Paused

- DIBBS integration — no code path targets DIBBS as a data source.
- Template packaging for resale — no code found.
- Browser extensions (SAM Copilot, DIBBS Helper) — no code exists in this repository for either.
- A weekly solicitation-intelligence pipeline and blog/social auto-publish tooling — no code found in this repository.
- **HubSpot integration** — scoped only (see 2026-08-23 session below), zero code written. Would give members a "push my paid opportunities to my own HubSpot" feature; also intended for Keith's own GovCon business use.
- **Native CRM ("Sourcing Pipeline")** — Phases 0 and 1 shipped and live-verified 2026-08-24 (see Implemented in Current Code and the Session entries below). Phases 2–5 remain unbuilt: Phase 2 (Kanban drag-drop board, deal detail page — where the already-written deal-level notes become visible — + Quotes into Proposal Builder), Phase 3 (activity/tasks + the note-sharing/flagging/moderation UI), Phase 4 (reporting), Phase 5 (HubSpot-parity stretch + adding Keith's other business entities to the shared directory). Scoping artifact: "Sourcing Pipeline" (kept in sync with the actual build this session, not linked in git).

## Current Risks and Technical Debt

- ~~**Stale Stripe tier/price mapping**~~ — **fixed 2026-08-24.** `api/stripe/webhook.js`'s `PRICE_TO_TIER['member']` pointed at a price ID that matched neither the live Stripe price nor the (separately stale, unused) one in `src/lib/stripe.js`'s dead `STRIPE_PRICES` map. Corrected to the value read directly from the `products` table (the real source of truth the live checkout endpoint uses), verified via an authorized read-only query. The `|| 'member'` fallback had been masking the bug in production — no user-facing impact, but the map itself was wrong.
- **Dead Lab Pro pricing entry:** `src/lib/stripe.js`'s price map still contains a `'lab-pro-monthly'` entry for the retired Lab Pro tier.
- **Manual tier-list duplication:** `api/notion/authorize.js` hardcodes an eligible-tiers list that must be kept manually in sync with `isMemberOrFounding()` in `src/lib/tier.js`.
- **Unused pagination code:** `src/lib/pagination.js` and its test file are no longer imported anywhere in `ProposalBuilder.jsx` — confirmed dead code.
- **Unverified Vercel configuration:** environment variables referenced by name in code were not checked against the live Vercel dashboard.
- **Authentication-confirmation status:** whether Supabase's "Confirm email" Auth requirement is currently turned on was not checked.
- **Notion single-tenant limitations:** `api/notion/stale-quote-alert.js` is hardcoded to one profile ID with no per-customer selector.
- Stale `DEPLOY.md` and incomplete checked-in schema documentation — `supabase-schema.sql` does not reflect several tables/columns known from code to exist in the live database.
- **Historical purchase-protection gap in `match_opportunities` (found and partially remediated 2026-08-23):** before the "never prune a match with a purchase against it" protection existed (added in version 9, 2026-08-21), the function's stale-match cleanup could delete `opportunity_matches` rows tied to a real, paid Suggested Bid purchase if a member's NAICS/PSC codes changed. 4 such orphaned purchases were found and manually restored for one profile (`404be639-e000-493d-a998-f7a60c289902`) this session. **Other profiles have not been audited for the same historical gap** — the protection now prevents new occurrences but does not retroactively find or fix old ones elsewhere.
- **AI fit-scoring (`score_opportunity_matches`) still unscheduled.** Function is complete and would fill in `recommendation`/`match_score` for matches with no rule-based bid-criteria verdict (currently ~318 `opportunity_matches` rows profile-wide have null recommendation). Needs: confirmation that `ANTHROPIC_API_KEY` is set as a project secret, and a decision on cron frequency/batch size, before scheduling. Draft cron SQL was prepared but **not executed**.
- ~~**`protect_note_removal_fields()` publicly callable despite an earlier "fix"**~~ — **actually fixed 2026-08-24.** The Phase 0 hardening migration revoked `EXECUTE` from the `anon` and `authenticated` roles directly, but the real grant Postgres created was on the `PUBLIC` pseudo-role, which both roles inherit independently of a per-role revoke — so that fix never took effect. Caught by re-running Supabase's security advisor after the Phase 1 deploy and confirming directly against `information_schema.routine_privileges` rather than trusting the advisor's cache. Now genuinely fixed (`revoke ... from public`). Real risk was low (a trigger-only function that errors outside trigger context), but the access control itself was wrong, not just theoretically — worth remembering `PUBLIC` vs. named roles as a distinct grantee for any future `revoke`.
- **HubSpot portal data-integrity bug (external to this repo, found 2026-08-23):** in Keith's own connected HubSpot account, the custom deal stages "Quote Requested" and "Quote Received" are mapped onto HubSpot's internal `closedwon`/`closedlost` stage IDs, so HubSpot is silently counting deals reaching those stages as won/lost regardless of actual outcome. Not fixed — flagged only, read-only recon. Also found: the account appears to already be at or near HubSpot Free's 10-custom-property-per-object cap (10 custom Deal properties already in use), which constrains any future integration's field design.

## External Configuration Requiring Verification

- Vercel environment variable values (names only are known from code).
- Whether Supabase's "Confirm email" Auth requirement is enabled.
- Live Notion workspace content and connection state beyond the single-tenant configuration confirmed above.
- `products.stripe_price_id` values for rows other than the Lab Member membership price.
- GitHub branch protection / CI configuration.
- Exact remaining custom-property headroom in Keith's live HubSpot portal (Settings → Properties) before any HubSpot build proceeds.
- Whether HubSpot's OAuth app review process applies to the scopes a future member-facing integration would need.

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

**Next recommended action:** Phase 2 (Kanban drag-drop board + deal detail page, which is also where the currently-invisible deal-level notes finally become visible) is the natural next step, but this is a recommendation, not an approved priority.

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

2026-08-24, America/New_York.
