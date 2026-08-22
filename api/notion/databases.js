// api/notion/databases.js
// Lists the Notion databases the customer shared with the GovCon Lab
// integration during OAuth consent, so Profile.jsx can offer them as a
// picker for which one is their Opportunities database. Notion's OAuth
// scope is exactly "whatever pages/databases the user picked on the
// consent screen" — there's no separate grant step, so search() here
// already reflects that choice.
//
// Only databases matching the actual Command Center template schema are
// offered — a customer can share any database during consent, but picking
// one that isn't a real copy of the template would either error out or
// silently write into the wrong fields. See api/_lib/notion-schema.js.

import { createClient } from '@supabase/supabase-js'
import { matchesCommandCenterSchema } from '../_lib/notion-schema.js'

const NOTION_VERSION = '2022-06-28'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  try {
    const { data: rows, error: tokenError } = await supabase.rpc('get_notion_access_token', {
      p_profile_id: userId,
    })
    if (tokenError) throw tokenError
    const row = rows?.[0]
    if (!row || row.status !== 'active') {
      return res.status(404).json({ error: 'No active Notion connection for this account' })
    }

    const searchRes = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        page_size: 100,
      }),
    })

    if (searchRes.status === 401) {
      await supabase.rpc('mark_notion_connection_revoked', { p_profile_id: userId })
      return res.status(401).json({ error: 'Notion connection was revoked. Please reconnect.', revoked: true })
    }
    if (!searchRes.ok) {
      const body = await searchRes.text().catch(() => '')
      console.error('Notion search failed:', searchRes.status, body)
      return res.status(502).json({ error: 'Could not reach Notion' })
    }

    const { results } = await searchRes.json()
    const databases = (results || [])
      .filter(matchesCommandCenterSchema)
      .map((db) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || '(untitled database)',
        url: db.url,
      }))

    return res.status(200).json({ databases, totalShared: (results || []).length })
  } catch (err) {
    console.error('Notion databases list error:', err)
    return res.status(500).json({ error: 'Could not list Notion databases' })
  }
}
