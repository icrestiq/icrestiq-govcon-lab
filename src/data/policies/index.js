// Content for /policies/:slug (see src/pages/PolicyPage.jsx). Sourced from
// the "GovCon Lab Website Policy Package" drafting document, with every
// bracketed placeholder filled in with the site's real contact/vendor
// details, effective-dated 2026-08-01. The Copyright/DMCA policy from that
// package is deliberately not included yet — the source document itself
// says not to publish a registered-agent section until iCrestiQ LLC has
// actually registered an agent with the U.S. Copyright Office, which
// hadn't happened as of this addition.
import { terms } from './terms'
import { privacy } from './privacy'
import { nutritionLabel } from './nutritionLabel'
import { cookies } from './cookies'
import { aiDisclosure } from './aiDisclosure'
import { communityGuidelines } from './communityGuidelines'
import { subscriptionPolicy } from './subscriptionPolicy'
import { disclaimers } from './disclaimers'

export const POLICIES = [
  terms,
  privacy,
  nutritionLabel,
  cookies,
  aiDisclosure,
  communityGuidelines,
  subscriptionPolicy,
  disclaimers,
]
