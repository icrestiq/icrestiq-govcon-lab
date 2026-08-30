export async function hasDownloadEntitlement(supabaseAdmin, userId, productId) {
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('user_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()

  if (purchaseError) throw purchaseError
  if (purchase) return true

  // Compatibility fallback for historical orders that may predate or have
  // missed the user_purchases upsert. New purchases normally have both rows.
  const { data: paidOrder, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (orderError) throw orderError
  return Boolean(paidOrder)
}
