import { EFFECTIVE_DATE, SUPPORT_EMAIL } from './shared'

export const subscriptionPolicy = {
  slug: 'subscription-policy',
  label: 'Subscription, Cancellation & Refund Policy',
  summary: 'How billing, renewal, cancellation, and refunds work for paid memberships and digital products.',
  effectiveDate: EFFECTIVE_DATE,
  blocks: [
    { type: 'h2', text: 'Clear checkout terms' },
    { type: 'p', text: 'The checkout page states the plan, price, billing interval, renewal terms, material restrictions, and how to cancel before the order is submitted. You must affirmatively consent to recurring charges. A receipt confirms the purchase.' },

    { type: 'h2', text: 'Renewal and cancellation' },
    { type: 'p', text: `Recurring memberships automatically renew until canceled. Cancel any time from your Dashboard's "Manage Billing" button, which opens your billing portal, or by contacting ${SUPPORT_EMAIL}. Cancellation stops future renewal charges; access ordinarily continues through the paid billing period unless law requires otherwise.` },

    { type: 'h2', text: 'Refunds' },
    { type: 'p', text: `Unless the checkout page expressly provides a trial, satisfaction period, or different refund right, membership fees and digital-product charges are nonrefundable after access is provided, except where required by law or where iCrestiQ confirms a billing error. If iCrestiQ materially discontinues a prepaid paid service, it may provide a prorated refund or comparable remedy. Submit billing disputes promptly to ${SUPPORT_EMAIL}. This policy does not limit nonwaivable consumer rights.` },

    { type: 'h2', text: 'Promotions and lifetime offers' },
    { type: 'p', text: 'Promotional pricing applies only under the stated eligibility, scope, and duration. "Lifetime" access means access for the commercial life of the identified GovCon Lab product or program, not the purchaser\'s lifetime, and does not guarantee that every future product, service, feature, or third-party cost is included. If a promotion says a discount continues for the life of an eligible recurring subscription, the discount ends when that subscription is canceled, expires, becomes delinquent, or is replaced, unless the offer states otherwise.' },

    { type: 'h2', text: 'Chargebacks' },
    { type: 'p', text: `Contact ${SUPPORT_EMAIL} first so we can investigate. Nothing in this Policy prevents a good-faith chargeback or other right provided by card-network rules or law. Fraudulent or abusive chargebacks may result in account suspension and collection of valid unpaid amounts.` },
  ],
}
