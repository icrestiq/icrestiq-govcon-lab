// api/_lib/convertkit.js
// Shared ConvertKit (Kit) subscribe helper. Previously only
// api/convertkit/subscribe.js called Kit's API directly, and that route
// requires firstName (this app's own validation, not Kit's — Kit's actual
// API treats first_name as optional) — which digest_subscribers never
// collects, so that endpoint couldn't be reused as-is for them. This
// helper is the shared piece both member signup and digest confirmation
// can call, so every real member AND every confirmed digest subscriber
// ends up in the same Kit list instead of digest subscribers never being
// added at all.

export async function subscribeToConvertKit({ email, firstName, lastName, fields, tags }) {
  const apiKey = process.env.CONVERTKIT_API_KEY
  const formId = process.env.CONVERTKIT_FORM_ID

  if (!apiKey || !formId) {
    console.warn('ConvertKit not configured — skipping subscription for', email)
    return { skipped: true }
  }

  try {
    const response = await fetch(
      `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          email,
          ...(firstName ? { first_name: firstName } : {}),
          fields: { ...(lastName ? { last_name: lastName } : {}), ...(fields || {}) },
          tags: tags || [],
        }),
      }
    )
    const data = await response.json()
    if (!response.ok) {
      console.error('ConvertKit subscribe error:', data)
      return { ok: false, data }
    }
    return { ok: true, data }
  } catch (err) {
    console.error('ConvertKit subscribe request failed:', err)
    return { ok: false, error: err.message }
  }
}
