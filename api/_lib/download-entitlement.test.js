import { describe, expect, it } from 'vitest'
import { hasDownloadEntitlement } from './download-entitlement.js'

function queryResult(data, error = null) {
  const query = {
    select: () => query,
    eq: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data, error }),
  }
  return query
}

function fakeSupabase({ purchase = null, purchaseError = null, order = null, orderError = null }) {
  return {
    from(table) {
      if (table === 'user_purchases') return queryResult(purchase, purchaseError)
      if (table === 'orders') return queryResult(order, orderError)
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('hasDownloadEntitlement', () => {
  it('accepts the canonical user_purchases record', async () => {
    const entitled = await hasDownloadEntitlement(
      fakeSupabase({ purchase: { id: 'purchase-1' } }),
      'user-1',
      'product-1',
    )
    expect(entitled).toBe(true)
  })

  it('accepts a paid historical order when user_purchases is missing', async () => {
    const entitled = await hasDownloadEntitlement(
      fakeSupabase({ order: { id: 'order-1' } }),
      'user-1',
      'product-1',
    )
    expect(entitled).toBe(true)
  })

  it('rejects a user with neither entitlement record', async () => {
    const entitled = await hasDownloadEntitlement(
      fakeSupabase({}),
      'user-1',
      'product-1',
    )
    expect(entitled).toBe(false)
  })

  it('fails closed when an entitlement query errors', async () => {
    await expect(hasDownloadEntitlement(
      fakeSupabase({ purchaseError: new Error('database unavailable') }),
      'user-1',
      'product-1',
    )).rejects.toThrow('database unavailable')
  })
})
