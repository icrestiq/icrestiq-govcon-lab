// api/convertkit/subscribe.js
// Adds new member to ConvertKit automatically on signup
// ConvertKit free plan: up to 10,000 subscribers

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { email, firstName, lastName } = req.body

    if (!email || !firstName) {
      return res.status(400).json({ error: 'Email and first name are required' })
    }

    const apiKey = process.env.CONVERTKIT_API_KEY
    const formId = process.env.CONVERTKIT_FORM_ID

    if (!apiKey || !formId) {
      console.warn('ConvertKit not configured — skipping subscription')
      return res.status(200).json({ message: 'ConvertKit not configured, skipped' })
    }

    const response = await fetch(
      `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          email,
          first_name: firstName,
          fields: {
            last_name: lastName || '',
            source: 'iCrestiQ GovCon Lab Signup',
            membership_tier: 'free',
          },
          tags: ['govcon-lab', 'new-member', 'free-tier'],
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('ConvertKit error:', data)
      return res.status(200).json({ message: 'Subscribed with warnings', data })
    }

    return res.status(200).json({ message: 'Successfully subscribed', data })
  } catch (err) {
    console.error('ConvertKit subscribe error:', err)
    return res.status(200).json({ message: 'Subscribe skipped due to error' })
  }
}
