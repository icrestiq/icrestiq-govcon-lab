import { EFFECTIVE_DATE, LEGAL_EMAIL, SUPPORT_EMAIL, MAILING_ADDRESS } from './shared'

export const terms = {
  slug: 'terms',
  label: 'Terms of Service',
  summary: 'The rules for using GovCon Lab — accounts, subscriptions, acceptable use, and dispute resolution.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: '1.1 Agreement and operator' },
    { type: 'p', text: `These Terms of Service ("Terms") govern access to govconlab.com and related websites, applications, communities, content, memberships, tools, emails, and services that link to these Terms (collectively, the "Services"). The Services are operated by iCrestiQ LLC, a South Carolina limited liability company ("iCrestiQ," "GovCon Lab," "we," "us," or "our"). By creating an account, purchasing a membership, clicking to accept, or using the Services, you agree to these Terms and the incorporated policies. If you do not agree, do not use the Services.` },

    { type: 'h2', text: '1.2 Eligibility and accounts' },
    { type: 'p', text: `You must be at least 18 years old and legally able to enter a binding contract. You must provide accurate information, keep credentials confidential, promptly update account information, and notify ${SUPPORT_EMAIL} of suspected unauthorized access. You are responsible for activity under your account. Accounts and membership benefits are personal and may not be transferred, resold, shared, or used to provide access to unauthorized users.` },

    { type: 'h2', text: '1.3 What GovCon Lab provides' },
    { type: 'p', text: `GovCon Lab provides educational content, community features, opportunity information, templates, software-assisted analysis, and workflow tools related to government contracting. Features, data sources, availability, and membership benefits may change. We may correct errors, update content, suspend features, or discontinue nonessential features. Material changes to paid benefits will be handled as described at checkout or by applicable law.` },

    { type: 'h2', text: '1.4 No government affiliation; no professional advice' },
    { type: 'p', text: `GovCon Lab and iCrestiQ LLC are private businesses. They are not a government agency, do not represent or speak for any federal, state, or local agency, and are not endorsed by SAM.gov, the U.S. General Services Administration, the Defense Logistics Agency, or any other government body. The Services provide general educational and informational material — not legal, accounting, tax, cybersecurity, export-control, procurement, engineering, or other professional advice. You remain responsible for reviewing the official solicitation, regulations, contract clauses, amendments, agency systems, and professional advice applicable to your circumstances.` },

    { type: 'h2', text: '1.5 No award, revenue, savings, or accuracy guarantee' },
    { type: 'p', text: `We do not guarantee contract awards, eligibility, certifications, bid responsiveness, profits, savings, supplier performance, opportunity availability, or any particular business result. Government and third-party data may be delayed, incomplete, inaccurate, changed, or removed. AI-generated and automated outputs can be wrong. Always verify material facts against authoritative sources before acting.` },

    { type: 'h2', text: '1.6 Subscriptions, billing, and taxes' },
    { type: 'p', text: `Paid plans renew automatically for the interval shown at checkout until canceled. Before purchase, we will present the price, billing interval, material restrictions, and cancellation method. You authorize the payment processor to charge the payment method on file, including applicable taxes. Prices may change prospectively after notice. Cancellation stops future renewals and ordinarily leaves access active through the paid term unless the checkout terms say otherwise. The Subscription, Cancellation & Refund Policy is incorporated into these Terms.` },

    { type: 'h2', text: '1.7 Acceptable use' },
    { type: 'p', text: 'You may use the Services only for lawful business and educational purposes. You may not:' },
    { type: 'ul', items: [
      'Violate law, procurement rules, platform terms, sanctions, export controls, intellectual-property rights, privacy rights, or contractual duties.',
      'Upload classified, controlled, source-selection-sensitive, export-controlled, proprietary, personal, or confidential information unless you have authority and the feature is expressly designed to receive it.',
      'Misrepresent identity, qualifications, certifications, small-business status, past performance, pricing, source authorization, or affiliation.',
      'Harass, threaten, discriminate, defame, dox, deceive, spam, scrape without permission, distribute malware, probe security, bypass limits, or interfere with the Services.',
      'Use the Services to coordinate bids unlawfully, fix prices, divide markets, submit false claims, facilitate kickbacks, or commit fraud.',
      'Copy, sell, sublicense, mass-download, train a competing model on, or commercially exploit GovCon Lab content or member data except as expressly permitted.',
      'Use automated access except through interfaces we authorize in writing.',
    ] },

    { type: 'h2', text: '1.8 User content' },
    { type: 'p', text: `"User Content" includes posts, comments, chats, reviews, testimonials, RFQ and supplier information, documents, images, messages, prompts, and other material submitted through the Services. You retain ownership of your User Content. You grant iCrestiQ a nonexclusive, worldwide, royalty-free license to host, store, reproduce, format, display, transmit, moderate, and otherwise use User Content only as reasonably necessary to operate, secure, improve, and provide the Services and as described in the Privacy Policy. This license ends when the content is deleted from active systems, subject to backups, legal retention, prior sharing, and content needed to preserve community context.` },
    { type: 'p', text: 'You represent that you have all rights and permissions needed to submit User Content and that it does not violate law or third-party rights. Do not treat community or AI features as confidential repositories. Other users may copy or disclose content they can access. We may — but are not obligated to — review, refuse, restrict, remove, preserve, or disclose User Content consistent with law and our policies.' },

    { type: 'h2', text: '1.9 Feedback and testimonials' },
    { type: 'p', text: `Suggestions and product feedback may be used without restriction or compensation. We will not use a member's name, likeness, testimonial, or identifiable case study in marketing without permission or another valid legal basis. Incentivized reviews or endorsements must clearly disclose the material connection. Reviews must reflect genuine experience and may not be fake, purchased, or AI-generated to impersonate a customer.` },

    { type: 'h2', text: '1.10 GovCon Lab intellectual property' },
    { type: 'p', text: 'The Services, branding, software, templates, compilation, design, and original content are owned by iCrestiQ or its licensors and protected by law. Subject to these Terms, we grant you a limited, revocable, nonexclusive, nontransferable license to access the Services and use downloaded member resources internally for your own business. No ownership transfers. Government works and third-party materials remain subject to their own rights and restrictions.' },

    { type: 'h2', text: '1.11 Third-party services and links' },
    { type: 'p', text: 'The Services may link to or interoperate with government sites, payment processors, analytics providers, advertising platforms, email providers, hosting providers, AI providers, and other third parties. Their terms and privacy practices apply to their services. We do not control or endorse third-party content and are not responsible for third-party availability, accuracy, security, or conduct.' },

    { type: 'h2', text: '1.12 Suspension and termination' },
    { type: 'p', text: 'You may stop using the Services or cancel as provided in the Subscription Policy. We may suspend or terminate access for violation of these Terms, legal or security risk, nonpayment, harmful conduct, or discontinuation of the Services. When practical, we will provide notice and a reasonable opportunity to cure, except for urgent safety, fraud, legal, or security concerns. Provisions that by nature should survive — including payment obligations, ownership, disclaimers, liability limits, indemnity, and dispute terms — survive termination.' },

    { type: 'h2', text: '1.13 Disclaimers' },
    { type: 'legalCaps', text: `To the maximum extent permitted by law, the Services are provided "as is" and "as available." iCrestiQ disclaims all express or implied warranties, including merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, and results. We do not warrant that the Services will be uninterrupted, secure, or error-free. Some jurisdictions do not allow certain disclaimers, so some of these terms may not apply to you.` },

    { type: 'h2', text: '1.14 Limitation of liability' },
    { type: 'legalCaps', text: `To the maximum extent permitted by law, iCrestiQ and its members, managers, employees, contractors, licensors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, data, business, opportunities, or goodwill, arising from or related to the Services. Our total liability for all claims will not exceed the greater of (a) the amount you paid to iCrestiQ for the Services during the 12 months before the event giving rise to the claim or (b) $100. These limits do not apply where prohibited or to liability that cannot lawfully be limited.` },

    { type: 'h2', text: '1.15 Indemnity' },
    { type: 'p', text: `To the extent permitted by law, you will defend, indemnify, and hold harmless iCrestiQ and its personnel from third-party claims, damages, losses, and reasonable costs arising from your User Content, unlawful conduct, misuse of the Services, or material breach of these Terms. This obligation does not apply to the extent a claim results from iCrestiQ's own unlawful conduct.` },

    { type: 'h2', text: '1.16 Dispute resolution; binding individual arbitration' },
    { type: 'callout', text: 'Important arbitration notice: this section affects your legal rights. It requires most disputes to be resolved by individual arbitration and includes a class-action and jury-trial waiver. Read it carefully. You may opt out within 30 days.' },

    { type: 'h3', text: 'Informal resolution first' },
    { type: 'p', text: `Before filing arbitration or a lawsuit, the claimant must send a signed, individualized written Notice of Dispute to ${LEGAL_EMAIL} and iCrestiQ LLC, ${MAILING_ADDRESS}. The notice must describe the claimant, account email, facts, legal basis, requested relief, and a good-faith calculation of claimed damages. The parties will attempt in good faith to resolve the matter for 30 days. Limitations periods are tolled during that period where permitted.` },

    { type: 'h3', text: 'Agreement to arbitrate' },
    { type: 'p', text: 'Except for the exclusions below, any dispute, claim, or controversy arising out of or relating to the Services, these Terms, marketing, privacy, membership, or the relationship between you and iCrestiQ will be resolved by binding individual arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules and, when applicable, its Mass Arbitration Supplementary Rules, as modified by this section. The Federal Arbitration Act governs interpretation and enforcement of this arbitration agreement.' },

    { type: 'h3', text: 'Procedure, location, and fees' },
    { type: 'p', text: 'Arbitration may occur by documents, telephone, video, or in person as the AAA rules permit. An in-person hearing will occur in the county where you live unless the parties agree otherwise. The arbitrator may award the same individual relief a court could award and must apply applicable law. Fees will be allocated under the AAA Consumer Rules, but iCrestiQ will pay amounts required for this clause to remain enforceable. AAA rules and filing information are available at adr.org.' },

    { type: 'h3', text: 'Individual relief only; class waiver' },
    { type: 'p', text: "The arbitrator may award relief only to the individual claimant and only as necessary to resolve that claimant's individual claim. You and iCrestiQ waive the right to bring, join, or participate in a class, collective, consolidated, coordinated, or representative action, except that the AAA Mass Arbitration Supplementary Rules may apply when their criteria are met. If a court finally determines that a particular request for public injunctive relief cannot be waived or arbitrated, that request alone may proceed in court after all arbitrable claims are completed." },

    { type: 'h3', text: 'Excluded matters' },
    { type: 'p', text: "Either party may bring an individual action in small-claims court if it remains within that court's jurisdiction. Either party may seek temporary or emergency injunctive relief in court to prevent unauthorized access, security abuse, or actual or threatened infringement or misappropriation of intellectual-property rights. Government enforcement agencies may exercise their lawful authority." },

    { type: 'h3', text: 'Jury waiver and opt-out' },
    { type: 'legalCaps', text: 'For disputes not subject to arbitration, you and iCrestiQ waive trial by jury to the maximum extent permitted by law.' },
    { type: 'p', text: `You may opt out of arbitration by sending a signed notice within 30 days after first accepting these Terms to ${LEGAL_EMAIL} with your name, account email, mailing address, and an unambiguous statement that you opt out of the GovCon Lab arbitration agreement. Opting out will not affect your access to the Services.` },

    { type: 'h3', text: 'If arbitration is unavailable' },
    { type: 'p', text: 'If AAA declines to administer a properly filed case and the parties cannot agree on another administrator, a court with jurisdiction will appoint an arbitrator under 9 U.S.C. § 5. If the arbitration agreement is found unenforceable as to a dispute, the remaining Terms continue to apply.' },

    { type: 'h2', text: '1.17 Governing law and courts' },
    { type: 'p', text: 'South Carolina law governs these Terms without regard to conflict-of-law principles, except that the Federal Arbitration Act governs arbitration. For claims properly excluded from arbitration, the parties consent to exclusive jurisdiction in the state and federal courts located in South Carolina, except where applicable consumer law requires otherwise.' },

    { type: 'h2', text: '1.18 Changes and contact' },
    { type: 'p', text: `We may update these Terms. For material changes, we will provide notice appropriate to the change and obtain renewed assent when required. The date above identifies the latest version. Questions: ${LEGAL_EMAIL}, iCrestiQ LLC, ${MAILING_ADDRESS}, South Carolina.` },
  ],
}
