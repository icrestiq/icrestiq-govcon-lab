import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Looks up the profile row for an authenticated user, and — this is the
  // important part now that "Confirm email" is on — creates it here if it
  // doesn't exist yet. signUp() still tries to create the profile
  // immediately (below), which works fine as long as signUp() also
  // returns a session (mailer_autoconfirm). Once email confirmation is
  // required, signUp() returns no session, so that immediate write runs
  // unauthenticated and is correctly rejected by the real RLS policy:
  // "Users can insert own profile" ... WITH CHECK (auth.uid() = id) — an
  // anonymous request can never satisfy that. This function is what
  // finishes the job the moment the user actually has a session (either
  // by clicking the confirmation link, or logging in afterward), using
  // the same username/first_name/last_name Supabase already stored on
  // the user at signup time via options.data, regardless of confirmation
  // state.
  async function fetchProfile(authUser) {
    const userId = authUser.id
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle() // null (not a thrown error) when no row exists yet
      if (error) throw error

      if (data) {
        setProfile(data)
      } else {
        const meta = authUser.user_metadata || {}
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            username: meta.username,
            first_name: meta.first_name,
            last_name: meta.last_name,
            email: authUser.email,
            role: 'member',
            created_at: new Date().toISOString(),
          })
          .select()
          .single()
        if (createError) throw createError
        setProfile(created)
      }
    } catch (err) {
      console.error('Profile fetch/create error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Updated signUp — now accepts firstName, lastName ──────
  async function signUp(email, password, { username, firstName, lastName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Whatever profile metadata the app already passes here must stay
        // exactly as-is — the profile row (immediately below, or later via
        // fetchProfile) is built from this, and dropping a field would
        // create members with blank names.
        data: { username, first_name: firstName, last_name: lastName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      }
    })
    if (error) throw error

    // Try to create the profile row now — this succeeds when
    // mailer_autoconfirm gives us a session immediately. If "Confirm
    // email" is on, data.session is null, this write runs unauthenticated,
    // and the real RLS policy (auth.uid() = id) correctly rejects it. That
    // is expected, not a bug: fetchProfile() above finishes the job the
    // moment this user has a real session, using the same metadata. Not
    // re-thrown, since failing to create the profile here must never block
    // signUp() itself from returning — the caller still needs data.session
    // (and data.user.identities, for the already-registered case) to
    // decide what to show.
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        first_name: firstName,
        last_name: lastName,
        email,
        role: 'member',
        created_at: new Date().toISOString(),
      })
      if (profileError) console.warn('Profile creation deferred (expected when email confirmation is required):', profileError.message)

      // Add to ConvertKit email list automatically
      try {
        await fetch('/api/convertkit/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, firstName, lastName }),
        })
      } catch (ckErr) {
        // Never block signup if ConvertKit fails
        console.warn('ConvertKit subscribe failed:', ckErr)
      }
    }

    return data
  }

  // Shared by both the Register "check your email" state and the Login
  // "email not confirmed" state — same call, same redirect target as
  // signUp() above, so a resent link behaves identically to the original.
  async function resendConfirmation(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) throw error
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
    updateProfile,
    isAdmin: profile?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)