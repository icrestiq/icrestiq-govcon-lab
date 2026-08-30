import { describe, expect, it } from 'vitest'
import { hasValidWebhookSecret } from './webhook-secret.js'

describe('hasValidWebhookSecret', () => {
  it('accepts a matching configured secret', () => {
    const req = { headers: { 'x-webhook-secret': 'configured-secret' } }

    expect(hasValidWebhookSecret(req, 'configured-secret')).toBe(true)
  })

  it('rejects a missing request header', () => {
    expect(hasValidWebhookSecret({ headers: {} }, 'configured-secret')).toBe(false)
  })

  it('rejects a mismatched request header', () => {
    const req = { headers: { 'x-webhook-secret': 'wrong-secret' } }

    expect(hasValidWebhookSecret(req, 'configured-secret')).toBe(false)
  })

  it('fails closed when the server secret is absent', () => {
    const req = { headers: { 'x-webhook-secret': 'anything' } }

    expect(hasValidWebhookSecret(req, undefined)).toBe(false)
    expect(hasValidWebhookSecret(req, '')).toBe(false)
  })
})
