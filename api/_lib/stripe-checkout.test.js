import { describe, expect, it } from 'vitest'
import { buildCheckoutSessionConfig } from './stripe-checkout.js'

const user = { id: 'verified-user', email: 'member@example.test' }
const baseProduct = {
  id: 'product-1',
  title: 'Test Product',
  stripe_price_id: 'price_123',
  is_subscription: false,
}

describe('buildCheckoutSessionConfig', () => {
  it('uses only the server-verified user identity in payment metadata', () => {
    const config = buildCheckoutSessionConfig({ product: baseProduct, user, baseUrl: 'https://govconlab.com' })

    expect(config.customer_email).toBe(user.email)
    expect(config.client_reference_id).toBe(user.id)
    expect(config.metadata).toEqual({
      userId: user.id,
      productId: baseProduct.id,
      productName: baseProduct.title,
    })
    expect(config.mode).toBe('payment')
    expect(config.payment_method_types).toEqual(['card', 'klarna', 'affirm'])
    expect(config.subscription_data).toBeUndefined()
  })

  it('preserves subscription metadata for webhook tier updates', () => {
    const product = { ...baseProduct, id: 'lab-monthly', is_subscription: true }
    const config = buildCheckoutSessionConfig({ product, user, baseUrl: 'https://govconlab.com' })

    expect(config.mode).toBe('subscription')
    expect(config.payment_method_types).toEqual(['card'])
    expect(config.subscription_data).toEqual({
      metadata: { userId: user.id, productId: product.id },
    })
  })
})
