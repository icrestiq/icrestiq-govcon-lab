// api/notion/status.js
// Lets the Profile page show connection status without ever reading
// notion_connections directly from the client — that table has zero RLS
// policies on purpose (see the notion_sync_infrastructure migration), so
// every read goes through a service-role-backed endpoint like this one.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  try {
    const { data, error } = await supabase
      .from('notion_connections')
      .select('workspace_name, status, opportunities_database_id, connected_at')
      .eq('profile_id', userId)
      .maybeSingle()
    if (error) throw error

    if (!data) return res.status(200).json({ connected: false })

    return res.status(200).json({
      connected: data.status === 'active',
      status: data.status,
      workspaceName: data.workspace_name,
      hasOpportunitiesDatabase: !!data.opportunities_database_id,
      connectedAt: data.connected_at,
    })
  } catch (err) {
    console.error('Notion status error:', err)
    return res.status(500).json({ error: 'Could not load Notion connection status' })
  }
}
