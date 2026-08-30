export async function createBillingPortalForUser({ supabaseAdmin, stripeClient, userId, returnUrl }) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (error || !profile?.stripe_customer_id) return null

  return stripeClient.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: returnUrl,
  })
}
