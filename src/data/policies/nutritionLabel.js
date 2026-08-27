import { EFFECTIVE_DATE, PRIVACY_EMAIL, PAYMENT_PROCESSOR, DATABASE_PROVIDER, HOSTING_PROVIDER, ANALYTICS_PROVIDER, AI_PROVIDER } from './shared'

export const nutritionLabel = {
  slug: 'privacy-nutrition-label',
  label: 'Privacy Nutrition Label',
  summary: 'A quick-reference table of data categories, in plain language — a shorter companion to the full Privacy Policy.',
  effectiveDate: EFFECTIVE_DATE,
  intro: 'This short-form label summarizes the categories of information GovCon Lab may collect. It does not replace the full Privacy Policy.',
  blocks: [
    { type: 'table',
      headers: ['Data category', 'Examples', 'Main uses', 'Typical sources'],
      rows: [
        ['Identity & contact', 'Name, username, email, phone, company, role, address', 'Accounts, support, membership, communications', 'You; referrals/partners'],
        ['Account & authentication', 'Account ID, tokens, permissions, login history, settings', 'Access, security, administration', `You; ${DATABASE_PROVIDER}`],
        ['Purchases & subscriptions', 'Plan, invoices, transaction IDs, renewals, limited payment metadata', 'Billing, refunds, tax, fraud prevention', `You; ${PAYMENT_PROCESSOR}`],
        ['Payment credentials', `Card/bank details collected by ${PAYMENT_PROCESSOR}; GovCon Lab does not store full card data`, 'Process payment', PAYMENT_PROCESSOR],
        ['Community & uploads', 'Posts, chats, comments, files, images, reviews, reactions, reports', 'Community, moderation, support', 'You; other users'],
        ['GovCon/professional', 'RFQs, suppliers, quotes, capabilities, certifications, preferences', 'Opportunity tools, workflow, recommendations', 'You; public/government sources'],
        ['Communications', 'Support messages, surveys, preferences, webinar records', 'Respond, improve, communicate', 'You; email/support providers'],
        ['Device & logs', 'IP, browser, OS, device IDs, timestamps, errors, security events', 'Operate, secure, debug', `Browser/device; ${HOSTING_PROVIDER}`],
        ['Usage & analytics', 'Pages, clicks, searches, downloads, sessions, email interactions', 'Analytics, improvement', ANALYTICS_PROVIDER],
        ['AI interactions', 'Prompts, inputs, files, outputs, feedback, safety metadata', 'Generate requested results, safety, improvement', `You; ${AI_PROVIDER}`],
        ['Sensitive data', 'Only what a user voluntarily submits; may include IDs or financial/business-sensitive records', 'Requested workflow, security, compliance', 'You'],
      ],
    },
    { type: 'h2', text: 'Quick answers' },
    { type: 'ul', items: [
      'Sold for money? No.',
      'Used for targeted advertising? No — GovCon Lab does not currently run advertising partnerships or tracking pixels.',
      'Shared publicly? Only content a user posts to a public or member-visible space, according to the feature settings.',
      'AI processing? Yes, when a user invokes AI-assisted features.',
      `Full payment card stored by GovCon Lab? No — payment credentials stay with ${PAYMENT_PROCESSOR}.`,
      `User controls? Account settings, unsubscribe links, and the privacy request email (${PRIVACY_EMAIL}).`,
    ] },
  ],
}
