import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './components/AuthScreen'
import Dashboard from './components/Dashboard'
import './index.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching profile:', error)
      return
    }
    setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--neutral-200)', borderTopColor: 'var(--primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading Sewa Nominal Roll Management System…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen onAuthed={(s) => { setSession(s); fetchProfile(s.user.id) }} />
  }

  // Approval gate: users without approved status see awaiting approval screen
  if (profile && profile.approval_status !== 'approved') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
        padding: 20,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary-700), var(--primary-500))',
            padding: '32px 32px 28px',
            color: 'white',
          }}>
            <div style={{
              width: 56,
              height: 56,
              margin: '0 auto 12px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {profile.approval_status === 'rejected' ? 'Access Rejected' : 'Awaiting Approval'}
            </h1>
          </div>
          <div style={{ padding: '32px' }}>
            <p style={{ fontSize: 15, color: 'var(--neutral-700)', marginBottom: 8, lineHeight: 1.5 }}>
              {profile.approval_status === 'rejected'
                ? 'Your account access has been rejected by the administrator. Please contact the admin for assistance.'
                : 'Your account is pending administrator approval. You will not be able to access the system until the admin approves your request.'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Signed in as: <strong>{profile.email}</strong>
            </p>
            <button
              onClick={() => {
                supabase.auth.signOut()
                setSession(null)
                setProfile(null)
              }}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dashboard
      session={session}
      profile={profile}
      onProfileUpdate={(p) => setProfile(p)}
      onSignOut={() => {
        supabase.auth.signOut()
        setSession(null)
        setProfile(null)
      }}
    />
  )
}
