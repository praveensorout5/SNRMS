import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COLUMNS = [
  { key: 's_no', label: 'S.No.', type: 'number', width: 60 },
  { key: 'sewa_from_date', label: 'Sewa From Date', type: 'date', width: 150 },
  { key: 'sewa_to_date', label: 'Sewa To Date', type: 'date', width: 150 },
  { key: 'department', label: 'Department', type: 'text', width: 160 },
  { key: 'center', label: 'Center', type: 'text', width: 140 },
  { key: 'no_of_sewadars', label: 'No. of Sewadars', type: 'number', width: 120 },
  { key: 'pdf', label: 'Signed Nominal Rolls (PDF)', type: 'pdf', width: 200 },
]

export default function Spreadsheet({ session, profile, activeSheet, view, currentMonth, canEdit, isAdmin, showToast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [uploadingFor, setUploadingFor] = useState(null)
  const fileInputRef = useRef(null)

  const fetchRows = useCallback(async (monthYear) => {
    setLoading(true)
    let query = supabase
      .from('nominal_rolls')
      .select('*')
      .eq('sheet_type', activeSheet)
      .order('s_no', { ascending: true })

    if (view === 'current') {
      query = query.eq('month_year', currentMonth)
    } else if (monthYear) {
      query = query.eq('month_year', monthYear)
    } else {
      query = query.neq('month_year', currentMonth)
    }

    const { data, error } = await query
    if (error) {
      showToast('Failed to load data', 'error')
      setRows([])
    } else {
      setRows(data || [])
      if (view === 'previous') {
        const months = [...new Set((data || []).map(r => r.month_year))].sort().reverse()
        setAvailableMonths(months)
        if (months.length > 0 && !monthYear) {
          setSelectedMonth(months[0])
        }
      }
    }
    setLoading(false)
  }, [activeSheet, view, currentMonth, showToast])

  useEffect(() => {
    fetchRows(view === 'previous' ? selectedMonth : null)
  }, [activeSheet, view, currentMonth, selectedMonth])

  const handleAddRow = async () => {
    const nextSNo = rows.length > 0 ? Math.max(...rows.map(r => r.s_no || 0)) + 1 : 1
    const { data, error } = await supabase
      .from('nominal_rolls')
      .insert({
        sheet_type: activeSheet,
        s_no: nextSNo,
        sewa_from_date: null,
        sewa_to_date: null,
        department: '',
        center: '',
        no_of_sewadars: 0,
        month_year: currentMonth,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (error) {
      showToast('Failed to add row: ' + error.message, 'error')
    } else {
      setRows([...rows, data])
      showToast('Row added', 'success')
    }
  }

  const handleDeleteRow = async (rowId) => {
    if (!confirm('Delete this row? This cannot be undone.')) return
    const { error } = await supabase
      .from('nominal_rolls')
      .delete()
      .eq('id', rowId)

    if (error) {
      showToast('Failed to delete row', 'error')
    } else {
      setRows(rows.filter(r => r.id !== rowId))
      showToast('Row deleted', 'success')
    }
  }

  const startEdit = (row, colKey) => {
    if (!canEdit) return
    setEditingCell({ rowId: row.id, colKey })
    setEditValue(row[colKey] ?? '')
  }

  const saveEdit = async () => {
    if (!editingCell) return
    const { rowId, colKey } = editingCell
    const value = colKey === 'no_of_sewadars' || colKey === 's_no'
      ? (editValue === '' ? null : parseInt(editValue, 10))
      : editValue

    const { error } = await supabase
      .from('nominal_rolls')
      .update({ [colKey]: value })
      .eq('id', rowId)

    if (error) {
      showToast('Failed to save', 'error')
    } else {
      setRows(rows.map(r => r.id === rowId ? { ...r, [colKey]: value } : r))
    }
    setEditingCell(null)
  }

  const handlePdfUpload = async (rowId, file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      showToast('Only PDF files are allowed', 'error')
      return
    }

    setUploadingFor(rowId)
    const filePath = `${activeSheet}/${currentMonth}/${rowId}/${Date.now()}-${file.name}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('nominal-rolls-pdfs')
        .upload(filePath, file, { contentType: 'application/pdf' })

      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('nominal_rolls')
        .update({ pdf_path: filePath, pdf_name: file.name })
        .eq('id', rowId)

      if (updateError) throw updateError

      setRows(rows.map(r => r.id === rowId ? { ...r, pdf_path: filePath, pdf_name: file.name } : r))
      showToast('PDF uploaded successfully', 'success')
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error')
    } finally {
      setUploadingFor(null)
    }
  }

  const getPdfUrl = (pdfPath) => {
    if (!pdfPath) return null
    const { data } = supabase.storage
      .from('nominal-rolls-pdfs')
      .getPublicUrl(pdfPath)
    return data?.publicUrl
  }

  const handleDeletePdf = async (rowId, pdfPath) => {
    if (!confirm('Remove this PDF?')) return
    const { error: storageError } = await supabase.storage
      .from('nominal-rolls-pdfs')
      .remove([pdfPath])

    const { error: updateError } = await supabase
      .from('nominal_rolls')
      .update({ pdf_path: null, pdf_name: null })
      .eq('id', rowId)

    if (updateError) {
      showToast('Failed to remove PDF', 'error')
    } else {
      setRows(rows.map(r => r.id === rowId ? { ...r, pdf_path: null, pdf_name: null } : r))
      showToast('PDF removed', 'success')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-GB')
    } catch {
      return dateStr
    }
  }

  const downloadCSV = () => {
    if (rows.length === 0) {
      showToast('No data to download', 'error')
      return
    }

    const headers = ['S.No.', 'Sewa From Date', 'Sewa To Date', 'Department', 'Center', 'No. of Sewadars', 'Signed Nominal Rolls (PDF)']
    const csvLines = [headers.join(',')]

    rows.forEach(row => {
      const pdfUrl = getPdfUrl(row.pdf_path)
      const values = [
        row.s_no ?? '',
        formatDate(row.sewa_from_date),
        formatDate(row.sewa_to_date),
        `"${(row.department || '').replace(/"/g, '""')}"`,
        `"${(row.center || '').replace(/"/g, '""')}"`,
        row.no_of_sewadars ?? '',
        pdfUrl ? `"${row.pdf_name || 'PDF'} - ${pdfUrl}"` : '',
      ]
      csvLines.push(values.join(','))
    })

    const csvContent = csvLines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const sheetName = activeSheet === 'bhati' ? 'Bhati' : 'Beas'
    const monthLabel = view === 'previous' && selectedMonth
      ? selectedMonth
      : currentMonth
    link.download = `Sewa_Nominal_Roll_${sheetName}_${monthLabel}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('CSV downloaded', 'success')
  }

  const downloadExcel = () => {
    if (rows.length === 0) {
      showToast('No data to download', 'error')
      return
    }

    const headers = ['S.No.', 'Sewa From Date', 'Sewa To Date', 'Department', 'Center', 'No. of Sewadars', 'Signed Nominal Rolls (PDF)']
    let html = '<table border="1">'
    html += '<tr style="background-color:#1d4ed8;color:white;font-weight:bold;">'
    headers.forEach(h => { html += `<th>${h}</th>` })
    html += '</tr>'

    rows.forEach(row => {
      const pdfUrl = getPdfUrl(row.pdf_path)
      html += '<tr>'
      html += `<td>${row.s_no ?? ''}</td>`
      html += `<td>${formatDate(row.sewa_from_date)}</td>`
      html += `<td>${formatDate(row.sewa_to_date)}</td>`
      html += `<td>${row.department || ''}</td>`
      html += `<td>${row.center || ''}</td>`
      html += `<td>${row.no_of_sewadars ?? ''}</td>`
      html += `<td>${pdfUrl ? `${row.pdf_name || 'PDF'} (${pdfUrl})` : ''}</td>`
      html += '</tr>'
    })
    html += '</table>'

    const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const sheetName = activeSheet === 'bhati' ? 'Bhati' : 'Beas'
    const monthLabel = view === 'previous' && selectedMonth
      ? selectedMonth
      : currentMonth
    link.download = `Sewa_Nominal_Roll_${sheetName}_${monthLabel}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Excel file downloaded', 'success')
  }

  const renderCell = (row, col) => {
    if (col.type === 'pdf') {
      const url = getPdfUrl(row.pdf_path)
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {url ? (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary-600)',
                  fontWeight: 500,
                  textDecoration: 'none',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'var(--primary-50)',
                  transition: 'background var(--transition)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {row.pdf_name || 'View PDF'}
              </a>
              {canEdit && (
                <button
                  onClick={() => handleDeletePdf(row.id, row.pdf_path)}
                  className="btn-sm btn-ghost"
                  style={{ padding: '4px 6px', color: 'var(--error-500)' }}
                  title="Remove PDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </>
          ) : canEdit ? (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--accent-50)',
                color: 'var(--accent-700)',
                border: '1px solid var(--accent-100)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all var(--transition)',
              }}
            >
              {uploadingFor === row.id ? 'Uploading…' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload PDF
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                disabled={uploadingFor === row.id}
                onChange={(e) => handlePdfUpload(row.id, e.target.files[0])}
              />
            </label>
          ) : (
            <span style={{ color: 'var(--neutral-400)', fontSize: 13 }}>No PDF</span>
          )}
        </div>
      )
    }

    if (editingCell?.rowId === row.id && editingCell?.colKey === col.key) {
      return (
        <input
          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={editValue}
          autoFocus
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit()
            if (e.key === 'Escape') setEditingCell(null)
          }}
          style={{
            width: '100%',
            border: '2px solid var(--primary-500)',
            borderRadius: 4,
            padding: '4px 6px',
            fontSize: 13,
            background: 'white',
            boxShadow: '0 0 0 3px var(--primary-100)',
          }}
        />
      )
    }

    const displayValue = row[col.key]
    let formatted = displayValue
    if (col.type === 'date' && displayValue) {
      formatted = new Date(displayValue).toLocaleDateString('en-GB')
    }
    if (col.type === 'number' && (displayValue === 0 || displayValue === null) && col.key === 'no_of_sewadars') {
      formatted = displayValue === 0 ? '0' : ''
    }

    return (
      <span
        onClick={() => startEdit(row, col.key)}
        style={{
          cursor: canEdit ? 'pointer' : 'default',
          display: 'block',
          padding: '2px 4px',
          borderRadius: 4,
          fontSize: 13,
          color: displayValue ? 'var(--text)' : 'var(--neutral-400)',
          minHeight: 20,
        }}
      >
        {formatted || (canEdit ? '—' : '')}
      </span>
    )
  }

  return (
    <div style={{ padding: '0 24px 24px' }}>
      {/* Month selector for previous months view */}
      {view === 'previous' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: '12px 16px',
          background: 'white',
          borderRadius: 8,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)' }}>Select Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 'auto', minWidth: 180 }}
          >
            {availableMonths.length === 0 && <option value="">No previous records</option>}
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} record{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '16px 0',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {view === 'current' && canEdit && (
            <button onClick={handleAddRow} className="btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Row
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {rows.length > 0 && (
            <>
              <button onClick={downloadCSV} className="btn-secondary btn-sm" title="Download as CSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </button>
              <button onClick={downloadExcel} className="btn-secondary btn-sm" title="Download as Excel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Excel
              </button>
            </>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} record{rows.length !== 1 ? 's' : ''} • {activeSheet === 'bhati' ? 'Bhati' : 'Beas'} Sheet
            {view === 'current' && !canEdit && ' • Read-only'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'white',
        borderRadius: 8,
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--neutral-200)', borderTopColor: 'var(--primary-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading records…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No records found</p>
            <p style={{ fontSize: 13 }}>
              {view === 'previous'
                ? 'No previous month records available.'
                : canEdit
                  ? 'Click "Add Row" to create the first entry.'
                  : 'No entries have been added for this month yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--neutral-600)',
                        background: 'var(--neutral-50)',
                        borderBottom: '2px solid var(--border)',
                        whiteSpace: 'nowrap',
                        minWidth: col.width,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                  {isAdmin && view === 'current' && (
                    <th style={{ width: 50, padding: '10px 12px', background: 'var(--neutral-50)', borderBottom: '2px solid var(--border)' }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background var(--transition)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {COLUMNS.map(col => (
                      <td
                        key={col.key}
                        style={{
                          padding: '8px 12px',
                          verticalAlign: 'middle',
                        }}
                      >
                        {renderCell(row, col)}
                      </td>
                    ))}
                    {isAdmin && view === 'current' && (
                      <td style={{ padding: '8px 12px' }}>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="btn-sm btn-ghost"
                          style={{ padding: '4px 6px', color: 'var(--error-500)' }}
                          title="Delete row"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
