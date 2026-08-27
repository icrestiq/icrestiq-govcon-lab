import { EFFECTIVE_DATE, SUPPORT_EMAIL, AI_PROVIDER } from './shared'

export const aiDisclosure = {
  slug: 'ai-disclosure',
  label: 'AI Transparency Disclosure',
  summary: 'How and where GovCon Lab uses AI, and what to expect (and verify) in AI-generated output.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: 'How GovCon Lab uses AI' },
    { type: 'p', text: `GovCon Lab uses artificial intelligence (${AI_PROVIDER}) and automated systems to summarize solicitations, classify opportunities, suggest matches, extract fields, draft proposal and RFQ content, answer questions, and personalize resources. AI-assisted material is identified through interface labels, this disclosure, or context appropriate to the feature.` },

    { type: 'h2', text: 'What users should expect' },
    { type: 'ul', items: [
      'AI output is probabilistic and may be incomplete, outdated, biased, or wrong.',
      'AI output is not an official government record and does not replace the solicitation, amendments, clauses, agency portal, or professional advice.',
      'You must verify quantities, deadlines, set-asides, approved sources, packaging, compliance, pricing, and submission instructions before bidding or acting.',
      'GovCon Lab does not guarantee that an AI recommendation is a suitable bid, supplier, price, or compliance determination.',
      'Do not enter classified, controlled unclassified, export-controlled, source-selection-sensitive, privileged, personal, or confidential data into AI features unless the workflow expressly authorizes it.',
    ] },

    { type: 'h2', text: 'Data and human oversight' },
    { type: 'p', text: `Inputs and outputs may be processed by ${AI_PROVIDER} to provide the requested feature, prevent misuse, and maintain quality, as described in the Privacy Policy. GovCon Lab may use human review for support, safety, moderation, evaluation, and correction subject to access controls. You can report problematic output at ${SUPPORT_EMAIL}. We will not present fabricated people, testimonials, or endorsements as real, and any material sponsorship or affiliate relationships will be disclosed clearly and conspicuously.` },
  ],
}
