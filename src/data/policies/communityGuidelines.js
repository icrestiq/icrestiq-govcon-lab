import { EFFECTIVE_DATE, MODERATION_EMAIL, APPEALS_EMAIL } from './shared'

export const communityGuidelines = {
  slug: 'community-guidelines',
  label: 'Community Guidelines & User-Generated Content Policy',
  summary: 'What you can and can’t post in chat, RFQ help, and other community spaces, and how moderation works.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: 'Community purpose' },
    { type: 'p', text: 'GovCon Lab is a professional learning community. Members may discuss opportunities, suppliers, pricing methods, workflows, and experiences, but each member remains responsible for legality, accuracy, confidentiality, and professional judgment.' },

    { type: 'h2', text: 'Permitted content' },
    { type: 'ul', items: [
      'Good-faith questions and experience-based answers.',
      'Lawfully shareable public opportunity and supplier information.',
      'Original templates, images, and documents the user has rights to share.',
      'Truthful reviews and testimonials that disclose incentives or other material connections.',
      'Constructive disagreement and correction of inaccurate information.',
    ] },

    { type: 'h2', text: 'Prohibited content' },
    { type: 'ul', items: [
      "Classified, CUI, source-selection information, sealed-bid information, export-controlled technical data, protected personal data, credentials, payment details, or another party's confidential information.",
      'False claims, forged documents, fake reviews, undisclosed paid endorsements, impersonation, deceptive AI-generated personas, or materially misleading statements.',
      'Bid coordination, price fixing, market allocation, kickbacks, bribery, fraud, sanctions evasion, or instructions to evade procurement rules.',
      'Harassment, threats, hate, discrimination, sexual exploitation, doxxing, defamation, or invasive surveillance.',
      'Copyright, trademark, privacy, publicity, or other rights violations.',
      'Spam, malware, phishing, credential theft, scraping, unauthorized solicitation, or attempts to compromise the Services.',
      'Content unrelated to the community purpose or repeated promotional content without permission.',
    ] },

    { type: 'h2', text: 'Supplier and RFQ information' },
    { type: 'p', text: 'Before posting supplier quotes, emails, or documents, remove personal contact details, pricing you are not authorized to disclose, account numbers, signatures, and confidential terms. Confirm that solicitation materials may lawfully be redistributed. A public government document is not a guarantee that every attachment or embedded item is unrestricted.' },

    { type: 'h2', text: 'Moderation and reporting' },
    { type: 'p', text: `Report content through the Report button on any post, or by emailing ${MODERATION_EMAIL}. We may investigate, label, limit visibility, remove content, preserve evidence, warn users, suspend accounts, or refer matters to authorities. Moderation decisions may consider context, severity, pattern, risk, and legal obligations. Submit an appeal within 14 days to ${APPEALS_EMAIL}. We do not promise to pre-screen or remove every objectionable post.` },

    { type: 'h2', text: 'Member interactions' },
    { type: 'p', text: 'Other members are independent third parties. GovCon Lab does not verify their identity, qualifications, products, pricing, authority, or advice. Conduct due diligence before sharing information, engaging a supplier, subcontractor, packager, consultant, or other member, or relying on a recommendation.' },
  ],
}
