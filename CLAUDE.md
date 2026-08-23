# iCrestiQ GovCon Lab — Claude Instructions

## Required Startup Reading

- Read PROJECT_HANDOFF.md at the beginning of each development session.
- Inspect current code before relying on historical documentation.
- DEPLOY.md is known to be stale and must not be treated as the current architecture source.

## Source-of-Truth Order

1. Current production behavior when explicitly verified
2. Current repository code
3. PROJECT_HANDOFF.md
4. Historical chat claims

Never describe code as live merely because it exists in the repository.

## Working Rules

- Do not expose or record credentials, tokens, API keys, webhook URLs, subscriber identities, personal data, payment details, or secret values.
- Environment-variable names are acceptable; values are not.
- Do not deploy, push, delete data, alter production configuration, or send external communications without explicit authorization.
- When a protected action is blocked, provide the exact safe user-run command instead of seeking a workaround.
- Do not use Claude's in-app browser for project verification because it has repeatedly crashed during this project.
- Preserve current architecture unless a requested change requires modifying it.
- Distinguish confirmed facts, inference, code implementation, and production verification.
- Do not treat recommended tasks as approved priorities.
- Do not update PROJECT_HANDOFF.md unless asked at the end of a meaningful work session.
- Do not query live production systems, provider dashboards, databases, subscriber records, Stripe, Supabase, Make.com, Vercel, Notion, Kit, or other external services unless the user explicitly authorizes that live-system check.

## Permission Rules

* Local edits, builds and tests: permitted
* Git commits: permitted when requested
* Pushes and production deployments: one-time explicit approval
* Database migrations or production-data changes: explicit approval with a preview
* Deletion, billing changes, secrets and customer communications: always require separate approval
* Never broaden or permanently save permissions without approval

## End-of-Session Handoff

When asked to update the handoff, record:

- Date
- Goal of the session
- Work completed
- Files and database objects changed
- Decisions and reasons
- Tests and results
- Deployment and verification status
- External dashboard changes not represented in git
- Problems and lessons
- Unresolved issues
- Next recommended action

Keep PROJECT_HANDOFF.md concise. Replace obsolete current-state information rather than accumulating a full transcript.
