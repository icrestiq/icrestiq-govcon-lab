# iCrestiQ GovCon Lab — Project Handoff

## Project Identity

React (Vite) SPA for govconlab.com — membership, community, and tooling platform for a small AI-assisted government-contracting business. Backend: Vercel serverless functions + Supabase (Postgres/Auth). Payments: Stripe. Repository: `C:\Users\Katki\icrestiq-govcon-lab`.

## Current Repository State

- **Branch:** `main`, confirmed in sync with `origin/main` this session.
- **Latest commit:** `a499b79` — "Raise Founding-tier Suggested Bid price from $1 to $2" — pushed 2026-08-24. A second commit lands in this same session adding the `api/stripe/webhook.js` price-map fix and this handoff update (see `git log` for its hash).
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

Membership/auth (Login, Register, Password Reset, email-confirmation flow, Turnstile bot protection) · Community chat · Blog (Supabase-backed, bot-visible Edge Middleware, dynamic sitemap) · Store + Stripe Checkout + Proposal Builder (PDF and Word/.docx export) · Matched Opportunities (SAM.gov ingestion, tier-gated; as of 2026-08-23 new-match creation is capped to opportunities posted in the last 5 days — see Decisions below) · Suggested Bid (paid AI research add-on, **$2/opportunity for both Lab Member and Founding as of 2026-08-24** — Founding's differentiator is now search depth, 8 vs. 5, not price; RFQ email drafts use the opportunity's real delivery destination when SAM.gov provides one, as of the same date) · `/go` lead-qualification quiz · Dashboard learning-path quiz · Admin panel with Site Analytics tab · Weekly digest signup with double opt-in, bot protections, and automated reminder waves · Notion Sync (OAuth connect, database picker, sync primitive — **confirmed 2026-08-23 to push only 8 basic listing fields, never the paid Suggested Bid research content**; see Partially Implemented) · Stale-quote follow-up alert (single-tenant).

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
- **Native CRM ("Sourcing Pipeline")** — scoping complete, zero code written, **build begins next session**. Replacement for the Notion/HubSpot hybrid: contacts (vendors/suppliers/contracting officers), a Kanban deal pipeline, and notes, auto-seeded from `bid_requests` the moment a Suggested Bid purchase completes. Scope narrowed against HubSpot's full feature set on 2026-08-24 (Quotes and lightweight email logging pulled into the near-term roadmap; Marketing Hub, Live Chat, Service Hub, scheduling/calling, lead scoring, and generic Custom Objects explicitly excluded). Scoping artifact: "Sourcing Pipeline" (published and updated this session, not linked in git). First step next session: resolve single-tenant vs. member-facing (Open Decision 01 in the artifact) before writing any schema.

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

**Next recommended action:** Begin the CRM build next session, starting with Open Decision 01 (single-tenant vs. member-facing) — every table's RLS design depends on the answer.

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
