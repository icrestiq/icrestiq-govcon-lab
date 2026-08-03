// api/digest/confirm.js
// Public endpoint hit by the confirmation link in the digest signup email.
// Marks the row confirmed=true, invalidates the token so the link can't be
// reused, then redirects to a plain result page.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://govconlab.com'
  const token = req.query?.token

  if (!token || typeof token !== 'string') {
    return res.redirect(302, `${baseUrl}/digest-confirmed?status=invalid`)
  }

  try {
    const { data, error } = await supabase
      .from('digest_subscribers')
      .update({
        confirmed: true,
        confirm_token: null,
        confirmed_at: new Date().toISOString(),
      })
      .eq('confirm_token', token)
      .select()
      .maybeSingle()

    if (error || !data) {
      return res.redirect(302, `${baseUrl}/digest-confirmed?status=invalid`)
    }

    return res.redirect(302, `${baseUrl}/digest-confirmed?status=ok`)
  } catch (err) {
    console.error('digest confirm error:', err)
    return res.redirect(302, `${baseUrl}/digest-confirmed?status=invalid`)
  }
}
