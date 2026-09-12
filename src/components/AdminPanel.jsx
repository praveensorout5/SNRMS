import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminPanel({ session, profile, onProfileUpdate, showToast, activeTab, setActiveTab }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      showToast('Failed to load users', 'error')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }, [showToast])

  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(200)

    if (error) {
      showToast('Failed to load audit logs', 'error')
    } else {
      setAuditLogs(data || [])
    }
    setLoadingLogs(false)
  }, [showToast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAuditLogs()
    }
  }, [activeTab, fetchAuditLogs])

  const toggleEditAccess = async (userId, currentCanEdit) => {
    const { error } = await supabase
      .from('profiles')
      .update({ can_edit: !currentCanEdit })
      .eq('id', userId)

    if (error) {
      showToast('Failed to update access', 'error')
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, can_edit: !currentCanEdit } : u))
      showToast('Edit access updated', 'success')
    }
  }

  const toggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, can_edit: newRole === 'admin' ? true : false })
      .eq('id', userId)

    if (error) {
      showToast('Failed to update role', 'error')
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole, can_edit: newRole === 'admin' } : u))
      showToast('Role updated', 'success')
    }
  }

  const approveUser = async (userId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved', approved_by: session.user.id, approved_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      showToast('Failed to approve user', 'error')
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, approval_status: 'approved' } : u))
      showToast('User approved', 'success')
    }
  }

  const rejectUser = async (userId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected', approved_by: session.user.id, approved_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      showToast('Failed to reject user', 'error')
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, approval_status: 'rejected' } : u))
      showToast('User rejected', 'success')
    }
  }

  const deleteUser = async (userId) => {
    if (!confirm('Delete this user permanently? They will lose all access and their account will be removed.')) return
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      showToast('Failed to delete user', 'error')
    } else {
      setUsers(users.filter(u => u.id !== userId))
      showToast('User deleted', 'success')
    }
  }

  const pendingCount = users.filter(u => u.approval_status === 'pending').length
  const approvedCount = users.filter(u => u.approval_status === 'approved').length

  const formatAuditValue = (vals) => {
    if (!vals) return '—'
    const fields = ['s_no', 'sewa_from_date', 'sewa_to_date', 'department', 'center', 'no_of_sewadars', 'pdf_name', 'sheet_type', 'month_year']
    const parts = []
    for (const f of fields) {
      if (vals[f] !== undefined && vals[f] !== null) {
        let v = vals[f]
        if (f.includes('date') && v) {
          try { v = new Date(v).toLocaleDateString('en-GB') } catch {}
        }
        parts.push(`${f}: ${v}`)
      }
    }
    return parts.length > 0 ? parts.join(', ') : JSON.stringify(vals).slice(0, 100)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-900)', marginBottom: 4 }}>
          Admin Panel
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Manage user approvals, edit access, and view change history.
        </p>
      </div>

      {/* Admin Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: '2px solid var(--border)',
        marginBottom: 24,
      }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: activeTab === 'users' ? 'var(--primary-600)' : 'var(--neutral-500)',
            fontWeight: 600,
            fontSize: 14,
            borderBottom: activeTab === 'users' ? '2px solid var(--primary-600)' : '2px solid transparent',
            marginBottom: '-2px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          User Approvals {pendingCount > 0 && (
            <span style={{
              marginLeft: 6,
              padding: '2px 8px',
              background: 'var(--warning-500)',
              color: 'white',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
            }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: activeTab === 'history' ? 'var(--primary-600)' : 'var(--neutral-500)',
            fontWeight: 600,
            fontSize: 14,
            borderBottom: activeTab === 'history' ? '2px solid var(--primary-600)' : '2px solid transparent',
            marginBottom: '-2px',
            borderRadius: '8px 8px 0 0',
          }}
        >
          Change History
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Users</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-600)' }}>{users.length}</p>
            </div>
            <div style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Approved</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success-600)' }}>{approvedCount}</p>
            </div>
            <div style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Pending</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning-600)' }}>{pendingCount}</p>
            </div>
            <div style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Can Edit</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-600)' }}>{users.filter(u => u.can_edit).length}</p>
            </div>
          </div>

          {/* Users Table */}
          <div style={{
            background: 'white',
            borderRadius: 8,
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading users…</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Email</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Role</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>PDF Upload</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background var(--transition)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                          {u.full_name || '—'}
                          {u.id === session.user.id && (
                            <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', background: 'var(--primary-100)', color: 'var(--primary-700)', borderRadius: 10, fontWeight: 600 }}>You</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{u.email}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {u.approval_status === 'approved' ? (
                            <span style={{ padding: '4px 10px', background: 'var(--success-100)', color: 'var(--success-700)', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Approved</span>
                          ) : u.approval_status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                onClick={() => approveUser(u.id)}
                                className="btn-sm"
                                style={{ background: 'var(--success-500)', color: 'white', fontWeight: 600, fontSize: 12 }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => rejectUser(u.id)}
                                className="btn-sm"
                                style={{ background: 'var(--error-100)', color: 'var(--error-700)', fontWeight: 600, fontSize: 12 }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ padding: '4px 10px', background: 'var(--error-100)', color: 'var(--error-700)', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>Rejected</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleRole(u.id, u.role)}
                            disabled={u.id === session.user.id || u.approval_status !== 'approved'}
                            className="btn-sm"
                            style={{
                              background: u.role === 'admin' ? 'var(--accent-100)' : 'var(--neutral-100)',
                              color: u.role === 'admin' ? 'var(--accent-700)' : 'var(--neutral-600)',
                              fontWeight: 600,
                              cursor: (u.id === session.user.id || u.approval_status !== 'approved') ? 'not-allowed' : 'pointer',
                              opacity: (u.id === session.user.id || u.approval_status !== 'approved') ? 0.6 : 1,
                            }}
                          >
                            {u.role === 'admin' ? 'Admin' : 'User'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleEditAccess(u.id, u.can_edit)}
                            disabled={u.role === 'admin' || u.approval_status !== 'approved'}
                            style={{
                              width: 44,
                              height: 24,
                              borderRadius: 12,
                              background: u.can_edit ? 'var(--accent-500)' : 'var(--neutral-300)',
                              position: 'relative',
                              transition: 'background var(--transition)',
                              cursor: (u.role === 'admin' || u.approval_status !== 'approved') ? 'not-allowed' : 'pointer',
                              opacity: (u.role === 'admin' || u.approval_status !== 'approved') ? 0.6 : 1,
                              padding: 0,
                            }}
                          >
                            <span style={{
                              position: 'absolute',
                              top: 3,
                              left: u.can_edit ? 23 : 3,
                              width: 18,
                              height: 18,
                              background: 'white',
                              borderRadius: '50%',
                              transition: 'left var(--transition)',
                              boxShadow: 'var(--shadow-sm)',
                            }} />
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {u.id !== session.user.id && (
                            <button
                              onClick={() => deleteUser(u.id)}
                              className="btn-sm btn-ghost"
                              style={{ padding: '4px 8px', color: 'var(--error-500)', fontSize: 12, fontWeight: 600 }}
                              title="Delete user"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Approve users to grant access. Toggle PDF upload to allow users to upload/download PDFs. Admins always have full access.
          </p>
        </>
      ) : (
        /* Change History Tab */
        <div style={{
          background: 'white',
          borderRadius: 8,
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
        }}>
          {loadingLogs ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading change history…</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 14 }}>No changes recorded yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Date & Time</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Action</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: 'var(--neutral-600)', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background var(--transition)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {new Date(log.changed_at).toLocaleString('en-GB')}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          background: log.action === 'INSERT' ? 'var(--success-100)' : log.action === 'UPDATE' ? 'var(--warning-100)' : 'var(--error-100)',
                          color: log.action === 'INSERT' ? 'var(--success-700)' : log.action === 'UPDATE' ? 'var(--warning-700)' : 'var(--error-700)',
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--neutral-700)' }}>
                        {log.action === 'INSERT' && (
                          <span>Added: {formatAuditValue(log.new_values)}</span>
                        )}
                        {log.action === 'UPDATE' && (
                          <span>
                            Changed from: {formatAuditValue(log.old_values)} → To: {formatAuditValue(log.new_values)}
                          </span>
                        )}
                        {log.action === 'DELETE' && (
                          <span>Deleted: {formatAuditValue(log.old_values)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
