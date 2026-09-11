import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Spreadsheet from './Spreadsheet'
import AdminPanel from './AdminPanel'
import Toast from './Toast'

export default function Dashboard({ session, profile, onProfileUpdate, onSignOut }) {
  const [activeSheet, setActiveSheet] = useState('bhati')
  const [view, setView] = useState('current')
  const [showAdmin, setShowAdmin] = useState(false)
  const [toast, setToast] = useState(null)
  const [currentMonth, setCurrentMonth] = useState('')

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(monthYear)
  }, [])

  const isAdmin = profile?.role === 'admin'
  const canEdit = isAdmin || profile?.can_edit

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Navbar */}
      <nav style={{
        background: 'linear-gradient(135deg, var(--primary-800), var(--primary-600))',
        color: 'white',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-md)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700 }}>Sewa Nominal Roll Management System</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '4px 12px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>{profile?.full_name || profile?.email}</span>
            <span style={{
              padding: '2px 8px',
              background: isAdmin ? 'var(--accent-500)' : 'var(--neutral-400)',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              {isAdmin ? 'Admin' : 'User'}
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="btn-sm"
              style={{
                background: showAdmin ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
                color: 'white',
              }}
            >
              {showAdmin ? 'Back to Sheet' : 'Admin Panel'}
            </button>
          )}
          <button
            onClick={onSignOut}
            className="btn-sm"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Content */}
      {showAdmin && isAdmin ? (
        <AdminPanel
          session={session}
          profile={profile}
          onProfileUpdate={onProfileUpdate}
          showToast={showToast}
        />
      ) : (
        <>
          {/* View Toggle: Current Month vs Previous Months */}
          <div style={{
            background: 'white',
            borderBottom: '1px solid var(--border)',
            padding: '12px 24px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex',
              background: 'var(--neutral-100)',
              borderRadius: 8,
              padding: 3,
            }}>
              <button
                onClick={() => setView('current')}
                className="btn-sm"
                style={{
                  background: view === 'current' ? 'white' : 'transparent',
                  color: view === 'current' ? 'var(--primary-600)' : 'var(--neutral-500)',
                  boxShadow: view === 'current' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Current Month
              </button>
              <button
                onClick={() => setView('previous')}
                className="btn-sm"
                style={{
                  background: view === 'previous' ? 'white' : 'transparent',
                  color: view === 'previous' ? 'var(--primary-600)' : 'var(--neutral-500)',
                  boxShadow: view === 'previous' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Previous Months
              </button>
            </div>
            {view === 'current' && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Sheet Tabs */}
          <div style={{ padding: '16px 24px 0' }}>
            <div style={{
              display: 'flex',
              gap: 4,
              borderBottom: '2px solid var(--border)',
            }}>
              {['bhati', 'beas'].map((sheet) => (
                <button
                  key={sheet}
                  onClick={() => setActiveSheet(sheet)}
                  style={{
                    padding: '10px 24px',
                    background: 'transparent',
                    color: activeSheet === sheet ? 'var(--primary-600)' : 'var(--neutral-500)',
                    fontWeight: 600,
                    fontSize: 14,
                    borderBottom: activeSheet === sheet ? '2px solid var(--primary-600)' : '2px solid transparent',
                    marginBottom: '-2px',
                    borderRadius: '8px 8px 0 0',
                    transition: 'all var(--transition)',
                  }}
                >
                  {sheet === 'bhati' ? 'Bhati' : 'Beas'}
                </button>
              ))}
            </div>
          </div>

          {/* Spreadsheet */}
          <Spreadsheet
            session={session}
            profile={profile}
            activeSheet={activeSheet}
            view={view}
            currentMonth={currentMonth}
            canEdit={canEdit}
            isAdmin={isAdmin}
            showToast={showToast}
          />
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
