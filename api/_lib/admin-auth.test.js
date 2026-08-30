import { describe, expect, it, vi } from 'vitest'
import { requireAdminUser } from './admin-auth.js'

function mockSupabase({ user, userError = null, profile, profileError = null }) {
  const single = vi.fn().mockResolvedValue({ data: profile, error: profileError })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: userError }) },
    from,
  }
}

describe('requireAdminUser', () => {
  it('accepts an authenticated admin', async () => {
    const user = { id: 'admin-user' }
    const supabase = mockSupabase({ user, profile: { role: 'admin' } })

    await expect(requireAdminUser(
      { headers: { authorization: 'Bearer valid-token' } },
      supabase,
    )).resolves.toEqual(user)
  })

  it('rejects an authenticated non-admin', async () => {
    const supabase = mockSupabase({ user: { id: 'member-user' }, profile: { role: 'member' } })

    await expect(requireAdminUser(
      { headers: { authorization: 'Bearer valid-token' } },
      supabase,
    )).resolves.toBeNull()
  })

  it('rejects a missing bearer token before querying profiles', async () => {
    const supabase = mockSupabase({ user: null, profile: { role: 'admin' } })

    await expect(requireAdminUser({ headers: {} }, supabase)).resolves.toBeNull()
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
