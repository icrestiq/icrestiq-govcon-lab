export function buildCheckoutSessionConfig({ product, user, baseUrl }) {
  const mode = product.is_subscription ? 'subscription' : 'payment'
  const paymentMethodTypes = mode === 'subscription'
    ? ['card']
    : ['card', 'klarna', 'affirm']

  const config = {
    mode,
    payment_method_types: paymentMethodTypes,
    line_items: [{ price: product.stripe_price_id, quantity: 1 }],
    customer_email: user.email || undefined,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      productId: product.id,
      productName: product.title,
    },
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&product=${product.id}`,
    cancel_url: `${baseUrl}/store`,
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
  }

  if (mode === 'subscription') {
    config.subscription_data = {
      metadata: { userId: user.id, productId: product.id },
    }
  }

  return config
}
