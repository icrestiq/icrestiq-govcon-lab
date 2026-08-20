// api/convertkit/subscribe.js
// Adds new member to ConvertKit automatically on signup
// ConvertKit free plan: up to 10,000 subscribers

import { subscribeToConvertKit } from '../_lib/convertkit.js'

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

    const outcome = await subscribeToConvertKit({
      email,
      firstName,
      lastName,
      fields: {
        source: 'iCrestiQ GovCon Lab Signup',
        membership_tier: 'free',
      },
      tags: ['govcon-lab', 'new-member', 'free-tier'],
    })

    if (outcome.skipped) {
      return res.status(200).json({ message: 'ConvertKit not configured, skipped' })
    }
    if (!outcome.ok) {
      console.error('ConvertKit error:', outcome.data || outcome.error)
      return res.status(200).json({ message: 'Subscribed with warnings', data: outcome.data })
    }

    return res.status(200).json({ message: 'Successfully subscribed', data: outcome.data })
  } catch (err) {
    console.error('ConvertKit subscribe error:', err)
    return res.status(200).json({ message: 'Subscribe skipped due to error' })
  }
}
