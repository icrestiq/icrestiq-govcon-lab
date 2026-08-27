import { EFFECTIVE_DATE } from './shared'

export const disclaimers = {
  slug: 'disclaimers',
  label: 'Government Contracting, Affiliate, and Results Disclaimers',
  summary: 'What GovCon Lab is not — not the government, not personalized advice, not a results guarantee — plus affiliate and community disclosures.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: 'Government contracting disclaimer' },
    { type: 'p', text: 'GovCon Lab is a private education and software service operated by iCrestiQ LLC. It is not affiliated with, endorsed by, or acting on behalf of the U.S. government or any agency. Government names, systems, marks, and public records are referenced for identification and educational purposes only. Official sources control.' },

    { type: 'h2', text: 'Educational and professional disclaimer' },
    { type: 'p', text: 'Content is general information and education. It is not legal, tax, accounting, procurement, cybersecurity, engineering, export-control, or financial advice. Rules and solicitations change. Consult qualified professionals and contracting officials when appropriate.' },

    { type: 'h2', text: 'Results disclaimer' },
    { type: 'p', text: 'Examples, case studies, revenue figures, savings, scores, and testimonials are illustrative and are not guarantees. Outcomes depend on experience, qualifications, market conditions, pricing, compliance, competition, effort, and other factors. Typical results may differ.' },

    { type: 'h2', text: 'Affiliate and sponsored-content disclosure' },
    { type: 'p', text: 'GovCon Lab may receive compensation when users purchase through certain links or when brands sponsor content. Any material relationship will be disclosed clearly near the relevant recommendation. Compensation does not permit false claims or guarantee a favorable review. Unless expressly stated, mentions of tools, vendors, or suppliers are not endorsements.' },

    { type: 'h2', text: 'Community disclaimer' },
    { type: 'p', text: "Member content represents the member's views, not iCrestiQ's. iCrestiQ does not verify every post and is not responsible for transactions or disputes between members, subject to rights that cannot legally be waived." },
  ],
}
