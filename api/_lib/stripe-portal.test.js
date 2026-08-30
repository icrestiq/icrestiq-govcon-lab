import { describe, expect, it, vi } from 'vitest'
import { createBillingPortalForUser } from './stripe-portal.js'

function fakeSupabase(profile, error = null) {
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: profile, error }),
  }
  return { from: () => query }
}

describe('createBillingPortalForUser', () => {
  it('creates a portal session for the authenticated user customer', async () => {
    const create = vi.fn().mockResolvedValue({ url: 'https://billing.example/session' })
    const session = await createBillingPortalForUser({
      supabaseAdmin: fakeSupabase({ stripe_customer_id: 'cus_123' }),
      stripeClient: { billingPortal: { sessions: { create } } },
      userId: 'user-1',
      returnUrl: 'https://govconlab.com/dashboard',
    })

    expect(session).toEqual({ url: 'https://billing.example/session' })
    expect(create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://govconlab.com/dashboard',
    })
  })

  it('does not call Stripe when the user has no customer', async () => {
    const create = vi.fn()
    const session = await createBillingPortalForUser({
      supabaseAdmin: fakeSupabase({ stripe_customer_id: null }),
      stripeClient: { billingPortal: { sessions: { create } } },
      userId: 'user-1',
      returnUrl: 'https://govconlab.com/dashboard',
    })

    expect(session).toBeNull()
    expect(create).not.toHaveBeenCalled()
  })
})
