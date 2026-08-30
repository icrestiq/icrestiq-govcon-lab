export function hasValidWebhookSecret(req, expectedSecret) {
  return Boolean(expectedSecret) && req.headers['x-webhook-secret'] === expectedSecret
}
