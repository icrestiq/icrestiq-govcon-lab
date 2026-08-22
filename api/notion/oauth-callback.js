// api/notion/oauth-callback.js
// Notion redirects here after the user approves (or denies) the connect
// request. Exchanges the code for an access token, stores it via the
// store_notion_connection RPC (which puts the real token in Supabase Vault,
// never in a plain column), and sends the browser back to the Profile page.
//
// Every exit path redirects to /profile?notion=<status> rather than
// returning JSON — there's no frontend caller waiting on a fetch response
// here, only a browser mid-redirect from Notion's own consent screen.

import { createClient } from '@supabase/supabase-js'
import { verifyState } from '../_lib/notion-state.js'
import { SITE_URL } from '../_lib/site-url.js'

const NOTION_REDIRECT_URI = 'https://govconlab.com/api/notion/oauth-callback'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function redirectToProfile(res, status) {
  return res.redirect(302, `${SITE_URL}/profile?notion=${status}`)
}

export default async function handler(req, res) {
  const { code, state, error: notionError } = req.query

  if (notionError) return redirectToProfile(res, 'denied')

  const profileId = verifyState(state)
  if (!profileId) return redirectToProfile(res, 'invalid_state')
  if (!code) return redirectToProfile(res, 'error')

  try {
    const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '')
      console.error('Notion token exchange failed:', tokenRes.status, body)
      return redirectToProfile(res, 'error')
    }

    const { access_token, workspace_id, workspace_name } = await tokenRes.json()

    const { error: rpcError } = await supabase.rpc('store_notion_connection', {
      p_profile_id: profileId,
      p_access_token: access_token,
      p_workspace_id: workspace_id,
      p_workspace_name: workspace_name || null,
    })
    if (rpcError) throw rpcError

    return redirectToProfile(res, 'connected')
  } catch (err) {
    console.error('Notion OAuth callback error:', err)
    return redirectToProfile(res, 'error')
  }
}
