import { EFFECTIVE_DATE, PRIVACY_EMAIL, ANALYTICS_PROVIDER, DATABASE_PROVIDER, HOSTING_PROVIDER } from './shared'

export const cookies = {
  slug: 'cookies',
  label: 'Cookie & Tracking Notice',
  summary: 'What cookies and tracking technologies GovCon Lab actually uses, and what choices you have.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: 'What these technologies do' },
    { type: 'p', text: 'GovCon Lab uses cookies, local storage, server logs, and similar technologies. These fall into these categories:' },
    { type: 'ul', items: [
      `Strictly necessary: authentication, security, fraud prevention, and checkout (via ${DATABASE_PROVIDER} and our payment processor). These cannot be disabled without breaking core account functionality.`,
      'Functional: remember optional preferences and improve convenience.',
      `Analytics: ${ANALYTICS_PROVIDER} measures traffic, feature use, errors, and performance. It is a cookieless, privacy-preserving analytics service — it does not set tracking cookies or build cross-site advertising profiles.`,
    ] },
    { type: 'callout', text: 'GovCon Lab does not currently use advertising cookies, tracking pixels, or any third-party ad network. We are not asking for consent to nonessential tracking because none is deployed. If that changes, this notice — and a cookie-preference control — will be updated before any such tracking goes live.' },

    { type: 'h2', text: 'Your choices' },
    { type: 'p', text: `Because no advertising or cross-site tracking cookies are in use, there is currently nothing to opt out of beyond the essential cookies required to keep you signed in and the site secure. If you'd still like to disable non-essential cookies your browser sets (or if you'd like more detail on what ${HOSTING_PROVIDER} and ${DATABASE_PROVIDER} set for authentication and security), your browser's own cookie controls will show and let you clear them — doing so will sign you out and may affect saved preferences. Where legally required, we will recognize Global Privacy Control or another recognized universal opt-out signal as a request to opt out of sale/sharing or targeted advertising, even though none currently occurs. Questions: ${PRIVACY_EMAIL}.` },

    { type: 'h2', text: 'Vendor inventory' },
    { type: 'p', text: `The technologies currently in use are: ${DATABASE_PROVIDER} (authentication/session cookies), ${HOSTING_PROVIDER} (server logs), and ${ANALYTICS_PROVIDER} (cookieless usage analytics), plus our payment processor's own checkout session during purchase. This list will be kept current as vendors change.` },
  ],
}
