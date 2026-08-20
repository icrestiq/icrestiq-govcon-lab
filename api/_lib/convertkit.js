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

// forms/subscribe's `tags` param takes numeric tag IDs, not names — Kit
// silently ignores the field if you send name strings (no error), so
// subscribes were succeeding while every tag went un-applied. Cached
// briefly since tags rarely change and this runs on every subscribe.
let tagCache = null
let tagCacheAt = 0
const TAG_CACHE_MS = 5 * 60 * 1000

async function resolveTagIds(apiKey, tagNames) {
  if (!tagNames || !tagNames.length) return []

  if (!tagCache || Date.now() - tagCacheAt > TAG_CACHE_MS) {
    try {
      const res = await fetch(`https://api.convertkit.com/v3/tags?api_key=${encodeURIComponent(apiKey)}`)
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.tags)) {
        console.error('ConvertKit list tags error:', data)
        return []
      }
      tagCache = new Map(data.tags.map((t) => [t.name.toLowerCase(), t.id]))
      tagCacheAt = Date.now()
    } catch (err) {
      console.error('ConvertKit list tags request failed:', err)
      return []
    }
  }

  const ids = []
  for (const name of tagNames) {
    const id = tagCache.get(String(name).toLowerCase())
    if (id) ids.push(id)
    else console.warn(`ConvertKit tag not found in account, skipping: ${name}`)
  }
  return ids
}

export async function subscribeToConvertKit({ email, firstName, lastName, fields, tags }) {
  const apiKey = process.env.CONVERTKIT_API_KEY
  const formId = process.env.CONVERTKIT_FORM_ID

  if (!apiKey || !formId) {
    console.warn('ConvertKit not configured — skipping subscription for', email)
    return { skipped: true }
  }

  try {
    const tagIds = await resolveTagIds(apiKey, tags)
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
          tags: tagIds,
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
