// api/notion/select-database.js
// Persists which Notion database is this customer's Opportunities database,
// once they've picked it from the list api/notion/databases.js returned.
// Re-checks the database is still reachable AND still matches the Command
// Center template schema before saving — both the picker list and the
// database itself could be stale (access revoked, or the customer
// restructured the database) between loading the list and clicking Save.

import { createClient } from '@supabase/supabase-js'
import { matchesCommandCenterSchema } from '../_lib/notion-schema.js'

const NOTION_VERSION = '2022-06-28'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, databaseId } = req.body || {}
  if (!userId || !databaseId) return res.status(400).json({ error: 'Missing userId or databaseId' })

  try {
    const { data: rows, error: tokenError } = await supabase.rpc('get_notion_access_token', {
      p_profile_id: userId,
    })
    if (tokenError) throw tokenError
    const row = rows?.[0]
    if (!row || row.status !== 'active') {
      return res.status(404).json({ error: 'No active Notion connection for this account' })
    }

    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${row.access_token}`,
        'Notion-Version': NOTION_VERSION,
      },
    })
    if (dbRes.status === 401) {
      await supabase.rpc('mark_notion_connection_revoked', { p_profile_id: userId })
      return res.status(401).json({ error: 'Notion connection was revoked. Please reconnect.', revoked: true })
    }
    if (!dbRes.ok) {
      return res.status(404).json({ error: 'That database is no longer accessible. Please pick another.' })
    }

    const notionDb = await dbRes.json()
    if (!matchesCommandCenterSchema(notionDb)) {
      return res.status(422).json({ error: "That database doesn't match the GovCon Command Center template. Please duplicate the template and pick that database instead." })
    }

    const { error: updateError } = await supabase
      .from('notion_connections')
      .update({ opportunities_database_id: databaseId, updated_at: new Date().toISOString() })
      .eq('profile_id', userId)
    if (updateError) throw updateError

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Notion select-database error:', err)
    return res.status(500).json({ error: 'Could not save your database selection' })
  }
}
