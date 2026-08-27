import {
  EFFECTIVE_DATE, PRIVACY_EMAIL, SECURITY_EMAIL, MAILING_ADDRESS,
  PAYMENT_PROCESSOR, EMAIL_PROVIDER, ANALYTICS_PROVIDER, AI_PROVIDER,
  HOSTING_PROVIDER, DATABASE_PROVIDER, RETENTION_TEXT,
} from './shared'

export const privacy = {
  slug: 'privacy',
  label: 'Privacy Policy',
  summary: 'What personal information we collect, why, who we share it with, and your privacy rights.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: '2.1 Scope and controller' },
    { type: 'p', text: `This Privacy Policy explains how iCrestiQ LLC collects, uses, discloses, and protects personal information through GovCon Lab. It does not govern third-party sites or services. iCrestiQ LLC is the business responsible for the practices described here. Contact: ${PRIVACY_EMAIL}, ${MAILING_ADDRESS}, South Carolina.` },

    { type: 'h2', text: '2.2 Information we collect' },
    { type: 'ul', items: [
      'Identity and contact data: name, username, email, telephone number, business name, role, mailing address, and profile details.',
      'Account and authentication data: account identifiers, hashed credentials or authentication tokens, plan, permissions, login history, and account settings.',
      `Transaction and subscription data: purchases, plan, renewal status, invoices, refunds, transaction identifiers, billing contact, and limited payment metadata. ${PAYMENT_PROCESSOR} — not GovCon Lab — collects full card numbers and security codes.`,
      'User Content and community data: posts, comments, chat messages, files, images, reviews, testimonials, reactions, reports, prompts, and moderation records.',
      'Government-contracting and professional data: RFQ/solicitation information, NAICS/FSC/PSC codes, agencies, products, suppliers, quote data, business capabilities, certifications, preferences, work history, and workflow records that users provide.',
      'Communications: support requests, survey responses, email preferences, meeting or webinar participation, and other correspondence.',
      'Device, network, and log data: IP address, browser, operating system, device identifiers, timestamps, referring pages, error logs, and security events.',
      'Usage and analytics data: pages and features used, clicks, searches, session activity, downloads, approximate location inferred from IP, and interactions with emails.',
      'AI interaction data: prompts, files or records submitted to AI features, outputs, feedback, safety signals, and usage metadata.',
      'Sensitive or regulated data you voluntarily submit: signatures, precise financial details, government identifiers, controlled business information, or other sensitive data. Do not submit such data unless requested through an authorized, appropriately secured workflow.',
    ] },

    { type: 'h2', text: '2.3 Sources' },
    { type: 'p', text: `We collect information directly from you; automatically from browsers, devices, cookies, pixels, and logs; from payment, email, hosting, analytics, and AI service providers; from government and public sources; from referrals and business partners; and from other members when they interact with or report content.` },

    { type: 'h2', text: '2.4 Why we use information' },
    { type: 'ul', items: [
      'Provide accounts, memberships, community features, content, downloads, opportunity tools, support, and requested transactions.',
      'Authenticate users, secure the Services, detect fraud and abuse, enforce policies, and maintain reliability.',
      "Personalize content, recommend opportunities or resources, and generate AI-assisted analysis at the user's request.",
      'Process payments, renewals, cancellations, refunds, accounting, and taxes.',
      'Send service communications and, with consent or as permitted, newsletters and marketing; honor unsubscribe requests.',
      'Measure performance, troubleshoot, research aggregate trends, improve features, and develop new services.',
      'Moderate communities, respond to disputes, comply with law, and protect rights, safety, and property.',
    ] },

    { type: 'h2', text: '2.5 How we disclose information' },
    { type: 'p', text: `We may disclose information to vendors that process data for us — such as ${DATABASE_PROVIDER}, ${PAYMENT_PROCESSOR}, ${EMAIL_PROVIDER}, ${HOSTING_PROVIDER}, ${ANALYTICS_PROVIDER}, ${AI_PROVIDER}, and customer-support and security providers — under appropriate agreements and instructions. We may also disclose information:` },
    { type: 'ul', items: [
      'To other users according to the audience and privacy settings of community content.',
      'At your direction or with your consent.',
      'To professional advisers, auditors, insurers, and financing or transaction counterparties subject to confidentiality obligations.',
      'When reasonably necessary to comply with law, legal process, government requests, protect safety or rights, investigate abuse, or enforce agreements.',
      'In connection with a merger, financing, reorganization, asset sale, or similar transaction, subject to legally required notice and protections.',
    ] },

    { type: 'h2', text: '2.6 Sale, sharing, and targeted advertising' },
    { type: 'p', text: `We do not sell personal information for money, and GovCon Lab does not currently run advertising partnerships or ad-tracking pixels. If that changes, this section will be updated before any such tracking goes live, since using advertising cookies or pixels can count as "sharing," "sale," or processing for targeted advertising under some state privacy laws even when no money changes hands. Where applicable, we honor a recognized browser-based opt-out signal such as Global Privacy Control as a request to opt out of sale/sharing, and you can always reach us at ${PRIVACY_EMAIL} with questions. We do not knowingly sell or share the personal information of anyone under 18.` },

    { type: 'h2', text: '2.7 Cookies and tracking' },
    { type: 'p', text: `We use essential technologies for authentication, security, fraud prevention, and service operation, and ${ANALYTICS_PROVIDER} — a cookieless analytics service — to understand how the site is used. GovCon Lab does not currently deploy advertising cookies or cross-site tracking pixels. See the Cookie & Tracking Notice for the full breakdown.` },

    { type: 'h2', text: '2.8 AI providers and automated tools' },
    { type: 'p', text: `Some features use ${AI_PROVIDER} or other automated systems. Information submitted to an AI feature may be sent to the identified AI provider to generate a response, prevent abuse, and operate the feature. We will configure provider data controls consistent with our contracts and disclosures. Do not submit classified, export-controlled, source-selection-sensitive, privileged, or other restricted information. We do not make solely automated decisions that produce legal or similarly significant effects about users unless we provide any notice and rights required by law.` },

    { type: 'h2', text: '2.9 Retention' },
    { type: 'p', text: RETENTION_TEXT },
    { type: 'p', text: 'Deleted data may remain temporarily in restricted backups and legal holds even after it is removed from active systems.' },

    { type: 'h2', text: '2.10 Security' },
    { type: 'p', text: `We use reasonable administrative, technical, and organizational safeguards appropriate to the information and risk. No system is completely secure. Users should use unique passwords, protect credentials, avoid unnecessary sensitive uploads, and report suspected incidents to ${SECURITY_EMAIL}.` },

    { type: 'h2', text: '2.11 Privacy rights' },
    { type: 'p', text: `Depending on where you live and applicable thresholds, you may have rights to know or access personal information; correct inaccuracies; delete information; obtain a portable copy; opt out of targeted advertising, sale, or certain profiling; limit certain sensitive-data uses; withdraw consent; and appeal a denied request. Submit a request to ${PRIVACY_EMAIL}. We may verify identity and authorized-agent authority. We will not unlawfully discriminate for exercising rights. If we deny an appeal, we will provide any regulator contact required by applicable law.` },

    { type: 'h2', text: '2.12 Email and communications' },
    { type: 'p', text: 'You may unsubscribe from marketing emails using the link in each message. We may still send nonmarketing account, transaction, security, or policy notices. Message and data rates may apply to any optional SMS service; separate consent and terms will be provided before enrollment.' },

    { type: 'h2', text: '2.13 Children' },
    { type: 'p', text: `The Services are intended for adults and are not directed to children under 13. Users must be at least 18. We do not knowingly collect personal information from children under 13. If you believe a child submitted information, contact ${PRIVACY_EMAIL} so we can investigate and take appropriate action.` },

    { type: 'h2', text: '2.14 International users' },
    { type: 'p', text: 'GovCon Lab is operated from the United States. If you access the Services from another country, information may be processed in the United States and other locations where providers operate.' },

    { type: 'h2', text: '2.15 Changes and contact' },
    { type: 'p', text: `We may update this Policy to reflect changed practices or law. We will post the new date and provide additional notice or consent when required. Questions or requests: ${PRIVACY_EMAIL}, iCrestiQ LLC, ${MAILING_ADDRESS}, South Carolina.` },
  ],
}
