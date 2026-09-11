import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        if (data.session) {
          onAuthed(data.session)
        } else {
          setError('Account created! Please sign in.')
          setMode('login')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuthed(data.session)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

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
        maxWidth: 420,
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        animation: 'fadeIn 300ms ease-out',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary-700), var(--primary-500))',
          padding: '32px 32px 28px',
          color: 'white',
          textAlign: 'center',
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
            fontSize: 28,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Sewa Nominal Roll</h1>
          <p style={{ fontSize: 13, opacity: 0.85 }}>Management System</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => { setMode('login'); setError('') }}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              color: mode === 'login' ? 'var(--primary-600)' : 'var(--neutral-400)',
              fontWeight: 600,
              borderBottom: mode === 'login' ? '2px solid var(--primary-600)' : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError('') }}
            style={{
              flex: 1,
              padding: '14px',
              background: 'transparent',
              color: mode === 'signup' ? 'var(--primary-600)' : 'var(--neutral-400)',
              fontWeight: 600,
              borderBottom: mode === 'signup' ? '2px solid var(--primary-600)' : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--neutral-700)', marginBottom: 6 }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--neutral-700)', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--neutral-700)', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--error-50)',
              border: '1px solid var(--error-100)',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--error-700)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <span
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              style={{ color: 'var(--primary-600)', fontWeight: 600, cursor: 'pointer' }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </span>
          </p>
        </form>
      </div>
    </div>
  )
}
