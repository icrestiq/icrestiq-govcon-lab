// api/_lib/notion-schema.js
// Confirms a candidate database is actually a copy of the GovCon Command
// Center template — not just any database the customer happens to share
// during OAuth consent. The customer still owns and connects their own
// Notion workspace; this only checks that the specific database picked is
// shaped the way the sync functions expect, since a database named
// "Opportunities" that isn't from the real template would otherwise either
// fail outright (property doesn't exist) or silently write into the wrong
// fields with no explanation to the customer.
//
// Property names/types matched against the live prototype's real schema
// (fetched via the Notion API, not guessed) — covers both what
// sync_opportunities_to_notion writes today and what the Sourcing Research
// sync will write next, so a customer doesn't need to reconnect/re-pick
// once that ships.
export const REQUIRED_PROPERTIES = {
  'Name': 'title',
  'Solicitation #': 'rich_text',
  'Agency': 'rich_text',
  'NAICS/PSC': 'rich_text',
  'Set-Aside': 'select',
  'Source': 'select',
  'Due Date': 'date',
  'Sourcing Research Status': 'select',
  'Proposed Suppliers': 'rich_text',
}

// `notionDb` is a Notion API database object (from /v1/search or
// /v1/databases/{id}) — both shapes carry the full `properties` schema.
export function matchesCommandCenterSchema(notionDb) {
  const properties = notionDb?.properties || {}
  return Object.entries(REQUIRED_PROPERTIES).every(
    ([name, type]) => properties[name]?.type === type
  )
}
