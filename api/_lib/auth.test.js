import { describe, expect, it, vi } from 'vitest'
import { getBearerToken, requireAuthenticatedUser } from './auth.js'

describe('getBearerToken', () => {
  it('returns a bearer token case-insensitively', () => {
    expect(getBearerToken({ headers: { authorization: 'Bearer token-123' } })).toBe('token-123')
    expect(getBearerToken({ headers: { authorization: 'bearer token-456' } })).toBe('token-456')
  })

  it('rejects missing and non-bearer authorization', () => {
    expect(getBearerToken({ headers: {} })).toBeNull()
    expect(getBearerToken({ headers: { authorization: 'Basic abc' } })).toBeNull()
    expect(getBearerToken({ headers: { authorization: 'Bearer' } })).toBeNull()
  })
})

describe('requireAuthenticatedUser', () => {
  it('does not call Supabase when the bearer token is missing', async () => {
    const getUser = vi.fn()
    const user = await requireAuthenticatedUser({ headers: {} }, { auth: { getUser } })
    expect(user).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('returns the user resolved by Supabase', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const user = await requireAuthenticatedUser(
      { headers: { authorization: 'Bearer valid-token' } },
      { auth: { getUser } },
    )
    expect(user).toEqual({ id: 'user-1' })
    expect(getUser).toHaveBeenCalledWith('valid-token')
  })

  it('rejects an invalid token', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    const user = await requireAuthenticatedUser(
      { headers: { authorization: 'Bearer invalid-token' } },
      { auth: { getUser } },
    )
    expect(user).toBeNull()
  })
})
