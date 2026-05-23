import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.js'
import { TrashIcon, SparkleIcon, CheckIcon, XIcon } from '../components/Icons.jsx'
import { Navigate } from 'react-router-dom'

export function AdminPage() {
  const { user, logout, isAdmin, isSarika } = useAuth()

  if (!user) return <Navigate to="/" />
  if (isSarika) return <SarikaApprovalView />
  if (isAdmin) return <AdminView />
  return <Navigate to="/" />
}

/* ════════════════════════════════════════════════════════════
   ADMIN VIEW (Ron)
════════════════════════════════════════════════════════════ */

function AdminView() {
  const { logout } = useAuth()
  const [posts, setPosts] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUploadForApproval, setShowUploadForApproval] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => {
    Promise.all([api.getAdminPosts(), api.getApprovalQueue()])
      .then(([p, q]) => { setPosts(p); setQueue(q) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this post permanently?')) return
    try {
      await api.deletePost(id)
      setPosts(p => p.filter(x => x.id !== id))
      showToast('Post deleted')
    } catch {}
  }

  const handleFeature = async (id) => {
    try {
      await api.featurePost(id)
      setPosts(p => p.map(x => x.id === id ? { ...x, featured: !x.featured } : x))
      showToast('Post updated')
    } catch {}
  }

  const handleSubmitForApproval = async (file, caption) => {
    const form = new FormData()
    form.append('file', file)
    form.append('caption', caption)
    const item = await api.submitForApproval(form)
    setQueue(q => [item, ...q])
    showToast('Sent to Sarika for approval ✦')
    setShowUploadForApproval(false)
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1rem 0.75rem', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <p className="font-display" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--gold-mid)', textTransform: 'uppercase' }}>Admin</p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 300, lineHeight: 1 }}>Control</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
      </div>

      <div className="page-content">

        {/* Approval Queue Status */}
        <div className="admin-section">
          <h3>Sarika's Approval Queue</h3>
          {queue.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No items pending approval.</p>
          ) : (
            queue.map(item => (
              <div key={item.id} className="card-surface" style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <img src={item.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.caption || 'No caption'}
                  </p>
                  {item.sarika_comment && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--gold-mid)', fontStyle: 'italic', marginBottom: '0.25rem' }}>
                      Sarika: "{item.sarika_comment}"
                    </p>
                  )}
                  <span className={`badge badge-${item.status}`}>
                    {item.status === 'pending' ? '⏳ Pending' : item.status === 'approved' ? '✓ Approved' : item.status === 'enhance' ? '✨ Enhance' : '✗ Denied'}
                  </span>
                </div>
              </div>
            ))
          )}
          <button className="btn btn-gold btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setShowUploadForApproval(true)}>
            + Submit Photo for Approval
          </button>
        </div>

        <div className="gold-line" />

        {/* All posts */}
        <div className="admin-section">
          <h3>All Posts ({posts.length})</h3>
          {loading ? (
            <div className="shimmer" style={{ height: 120 }} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {posts.map(p => (
                <div key={p.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: p.featured ? '2px solid var(--gold-mid)' : '1px solid var(--dark-border)' }}>
                  {p.type === 'video'
                    ? <div style={{ width: '100%', height: '100%', background: 'var(--dark-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🎬</div>
                    : <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  }
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', background: 'rgba(0,0,0,0.65)' }}>
                    <button onClick={() => handleFeature(p.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '4px', cursor: 'pointer', fontSize: '0.7rem', color: p.featured ? 'var(--gold-mid)' : 'rgba(255,255,255,0.5)' }}>★</button>
                    <button onClick={() => handleDelete(p.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'rgba(231,76,60,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUploadForApproval && (
        <SubmitForApprovalModal
          onClose={() => setShowUploadForApproval(false)}
          onSubmit={handleSubmitForApproval}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ── Submit for Approval Modal ─────────────────────────────── */

function SubmitForApprovalModal({ onClose, onSubmit }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    try { await onSubmit(file, caption) }
    catch {}
    setLoading(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="label">Submit for Sarika's Approval</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.5 }}>
          Sarika will review this photo and can approve, deny, or request enhancement before it goes live.
        </p>

        {!preview ? (
          <div className="upload-area" onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Choose a photo</p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <img src={preview} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 220, objectFit: 'cover', display: 'block', marginBottom: '0.75rem' }} />
        )}

        <textarea className="textarea" placeholder="Caption or notes for Sarika…" value={caption} onChange={e => setCaption(e.target.value)} style={{ marginTop: '0.75rem' }} rows={2} />
        <button className="btn btn-gold btn-full" style={{ marginTop: '0.75rem' }} onClick={handleSubmit} disabled={loading || !file}>
          {loading ? 'Sending…' : '👑 Send to Sarika'}
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   SARIKA'S VIEW — Approval Flow
════════════════════════════════════════════════════════════ */

function SarikaApprovalView() {
  const { logout } = useAuth()
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiSuggestion, setAiSuggestion] = useState({})
  const [aiLoading, setAiLoading] = useState({})
  const [comments, setComments] = useState({})
  const { toast, showToast } = useToast()

  useEffect(() => {
    api.getApprovalQueue()
      .then(data => setQueue(data.filter(x => x.status === 'pending')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const respond = async (id, action) => {
    const comment = comments[id] || ''
    try {
      await api.respondToApproval(id, action, comment)
      setQueue(q => q.filter(x => x.id !== id))
      const labels = { approved: '✓ Approved and published', denied: '✗ Photo declined', enhance: '✨ Enhancement requested' }
      showToast(labels[action] || 'Done')
    } catch {}
  }

  const getAiSuggestion = async (item) => {
    setAiLoading(s => ({ ...s, [item.id]: true }))
    try {
      const { suggestion } = await api.enhancePhoto(item.caption || 'A celebration photo')
      setAiSuggestion(s => ({ ...s, [item.id]: suggestion }))
    } catch {
      setAiSuggestion(s => ({ ...s, [item.id]: 'Could not load suggestion.' }))
    }
    setAiLoading(s => ({ ...s, [item.id]: false }))
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1rem 0.75rem', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <p className="font-display" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--gold-mid)', textTransform: 'uppercase' }}>Sarika</p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 300, lineHeight: 1 }}>Approvals</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
      </div>

      <div style={{ padding: '0.75rem', background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.5 }}>
          Welcome, Sarika 👑 — Review photos Ron has selected for your album.
        </p>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="shimmer" style={{ height: 300 }} />
        ) : queue.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
            <p style={{ color: 'var(--text-secondary)' }}>You're all caught up!<br />No photos awaiting review.</p>
          </div>
        ) : (
          queue.map(item => (
            <div key={item.id} className="approval-card" style={{ marginBottom: '1.5rem' }}>
              <img src={item.url} alt={item.caption || ''} />

              {item.caption && (
                <div style={{ padding: '0.75rem 0.9rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {item.caption}
                </div>
              )}

              {/* AI Enhancement Suggestion */}
              <div style={{ padding: '0.75rem 0.9rem' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => getAiSuggestion(item)}
                  disabled={aiLoading[item.id]}
                  style={{ gap: '0.35rem' }}
                >
                  <span style={{ fontSize: '0.9rem' }}>✨</span>
                  {aiLoading[item.id] ? 'Asking AI…' : 'Get Enhancement Suggestions'}
                </button>
                {aiSuggestion[item.id] && (
                  <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold-mid)', fontSize: '0.7rem', fontFamily: "'Cinzel', serif", letterSpacing: '0.08em', display: 'block', marginBottom: '0.3rem' }}>AI SUGGESTS</span>
                    {aiSuggestion[item.id]}
                  </div>
                )}
              </div>

              {/* Comment */}
              <div style={{ padding: '0 0.9rem 0.75rem' }}>
                <textarea
                  className="textarea"
                  placeholder="Leave a note for Ron (optional)…"
                  rows={2}
                  value={comments[item.id] || ''}
                  onChange={e => setComments(c => ({ ...c, [item.id]: e.target.value }))}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Action buttons */}
              <div className="approval-actions">
                <button className="btn btn-sm" style={{ background: 'rgba(39,174,96,0.12)', color: '#2ecc71', border: '1px solid rgba(39,174,96,0.25)' }} onClick={() => respond(item.id, 'approved')}>
                  ✓ Approve
                </button>
                <button className="btn btn-sm" style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold-light)', border: '1px solid rgba(201,168,76,0.2)' }} onClick={() => respond(item.id, 'enhance')}>
                  ✨ Enhance
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => respond(item.id, 'denied')}>
                  ✗ Deny
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
