# iCrestiQ GovCon Lab — Project Handoff

## Project Identity

React (Vite) SPA for govconlab.com — membership, community, and tooling platform for a small AI-assisted government-contracting business. Backend: Vercel serverless functions + Supabase (Postgres/Auth). Payments: Stripe. Repository: `C:\Users\Katki\icrestiq-govcon-lab`.

## Current Repository State

- **Branch:** `main`. Local `main` and `origin/main` point to the same commit — no divergence detected from ref inspection.
- **Latest commit:** `492d3f48e7d2dfdae04c7bf37f6a5a5305b097aa` — "Add Notion sync (OAuth connect, tier-gated), Suggested Bid Notion write-back, quote follow-up alert, and pricing/membership updates" — committed 2026-08-21 23:03 EDT.

## Current Architecture

- Frontend: React 18 + Vite 5, client-rendered SPA, React Router v6, CSS Modules, route-level code splitting.
- Backend: Vercel serverless functions (Node, ESM) under `api/`, grouped by domain (`admin/`, `convertkit/`, `digest/`, `notion/`, `proposal/`, `quiz/`, `slack/`, `stripe/`, `upload/`, `_lib/`).
- Database/Auth: Supabase Postgres + Auth. All inspected tables RLS-enabled.
- Payments: Stripe. Membership checkout reads `stripe_price_id` dynamically from Supabase's `products` table rather than hardcoding it in frontend code.
- Email: Gmail SMTP via `nodemailer` for app-originated transactional mail; Supabase's own Auth mailer separately handles account confirmation/password-reset mail.
- Scheduling: Vercel Cron (`vercel.json`, 2 jobs — digest reminders every 5 min, stale-quote alert daily) + Supabase `pg_cron` (5 active jobs confirmed by direct query: SAM.gov ingestion, opportunity matching, Notion sync push, expired-match purge, monthly rewards; no AI fit-scoring job is currently scheduled).
- External systems referenced in code: Notion API (OAuth), Slack (incoming webhook), Kit/ConvertKit API, SAM.gov (ingestion source).

## Implemented in Current Code

Membership/auth (Login, Register, Password Reset, email-confirmation flow, Turnstile bot protection) · Community chat · Blog (Supabase-backed, bot-visible Edge Middleware, dynamic sitemap) · Store + Stripe Checkout + Proposal Builder (PDF and Word/.docx export) · Matched Opportunities (SAM.gov ingestion, tier-gated) · Suggested Bid (paid AI research add-on) · `/go` lead-qualification quiz · Dashboard learning-path quiz · Admin panel with Site Analytics tab · Weekly digest signup with double opt-in, bot protections, and automated reminder waves · Notion Sync (OAuth connect, database picker, sync primitive, Sourcing Research content-field write-back) · Stale-quote follow-up alert (single-tenant).

## Production Verified

Only behavior with actual production-test evidence independently available in the current project context (this session has no access to application logs, prior chat transcripts, or a live browser session — only direct code inspection plus direct API/database queries performed this session). The Stripe and Supabase checks below were performed during the 2026-08-22 reconciliation and represent point-in-time external verification, not an ongoing or automatically-refreshed status:

- Lab Member Stripe price was live and active at $47/mo, confirmed via a direct Stripe API price lookup during the 2026-08-22 reconciliation.
- 5 Supabase `pg_cron` jobs were active as listed above, and no AI fit-scoring job was scheduled, confirmed via a direct `cron.job` query during the 2026-08-22 reconciliation.
- All inspected Supabase tables had RLS enabled, including `notion_connections`, confirmed via direct query during the 2026-08-22 reconciliation.
- Live Supabase state was consistent with the documented single-tenant Notion configuration when checked during the 2026-08-22 reconciliation. This is a dated operational verification, not a permanent count.

**No independently-available production-test evidence exists in the current context for any other feature above** (bot protections, digest email delivery, NAICS selector, Word/PDF export correctness, auth-confirmation flow, stale-quote alert delivery, etc.). These are implemented in code but their live behavior has not been re-verified in this session — treat as code-confirmed only until re-tested.

## Partially Implemented

- Sourcing Research → Notion content-field write-back was historically reported as completed and smoke-tested, but its Supabase Edge Function source is not stored in this repository and was not independently verified during the repository review. Six Bid/No-Go gate fields remain reported as unwired.
- Managed Data Feed (recurring re-check + Compliance sync + Stripe pause/resume): no corresponding code found.
- SAM.gov → Notion backfill completeness: not determinable from code alone.

## Planned or Paused

- DIBBS integration — no code path targets DIBBS as a data source.
- Template packaging for resale — no code found.
- Browser extensions (SAM Copilot, DIBBS Helper) — no code exists in this repository for either.
- A weekly solicitation-intelligence pipeline and blog/social auto-publish tooling — no code found in this repository.

## Current Risks and Technical Debt

- **Stale Stripe tier/price mapping:** `api/stripe/webhook.js`'s price→tier map hardcodes a Lab Member price ID that is inactive in Stripe (confirmed via direct Stripe check); the active price uses a different ID not present in the map. A fallback default currently keeps new subscriptions tagged correctly, but the map itself needs updating.
- **Dead Lab Pro pricing entry:** `src/lib/stripe.js`'s price map still contains a `'lab-pro-monthly'` entry for the retired Lab Pro tier.
- **Manual tier-list duplication:** `api/notion/authorize.js` hardcodes an eligible-tiers list that must be kept manually in sync with `isMemberOrFounding()` in `src/lib/tier.js`.
- **Unused pagination code:** `src/lib/pagination.js` and its test file are no longer imported anywhere in `ProposalBuilder.jsx` — confirmed dead code.
- **Unverified Vercel configuration:** environment variables referenced by name in code (`SLACK_STALE_QUOTES_WEBHOOK_URL`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`) were not checked against the live Vercel dashboard this session.
- **Authentication-confirmation status:** Register/Login/ForgotPassword/ResetPassword pages implement a full "Confirm email" flow, but whether Supabase's Auth setting requiring email confirmation is currently turned on was not checked this session.
- **Notion single-tenant limitations:** `api/notion/stale-quote-alert.js` is hardcoded to one profile ID with no per-customer selector — a known blocker before this feature could serve more than one account.
- Stale `DEPLOY.md` and incomplete checked-in schema documentation — `supabase-schema.sql` does not reflect several tables/columns known from code to exist in the live database (applied directly in Supabase rather than via checked-in migrations).

## External Configuration Requiring Verification

- Vercel environment variable values (names only are known from code).
- Whether Supabase's "Confirm email" Auth requirement is enabled.
- Live Notion workspace content and connection state beyond the single-tenant configuration confirmed above.
- `products.stripe_price_id` values for rows other than the Lab Member membership price.
- GitHub branch protection / CI configuration.

## Current Work

Working-tree status has not been verified. Run `git status` before assuming the repository is clean or identifying in-flight work.

## Next Recommended Action

Run `git status` and `git log -3` locally to confirm the working tree is clean and the commit shown above is still accurate, then address the stale Stripe price mapping in `api/stripe/webhook.js`. This is a recommendation, not an approved priority.

## Last Handoff Update

2026-08-22, 23:24 America/New_York.
