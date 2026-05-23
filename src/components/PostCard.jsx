import { useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { TrashIcon } from './Icons.jsx'

const REACTIONS = [
  { type: 'thumb', emoji: '👍' },
  { type: 'wow',   emoji: '🤩' },
  { type: 'fire',  emoji: '🔥' },
]

function timeAgo(ts) {
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`
  return `${Math.floor(secs/86400)}d ago`
}

export function PostCard({ post, onDelete }) {
  const { user, isAdmin } = useAuth()
  const [reactions, setReactions] = useState(post.reactions || { thumb: 0, wow: 0, fire: 0 })
  const [comments, setComments] = useState(post.comments || [])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [guestName, setGuestName] = useState(localStorage.getItem('sarika_guest_name') || '')
  const [loading, setLoading] = useState(false)

  const handleReact = async (type) => {
    setReactions(r => ({ ...r, [type]: r[type] + 1 }))
    try { await api.react(post.id, type) } catch {}
  }

  const handleComment = async () => {
    const text = commentText.trim()
    const name = guestName.trim() || 'Guest'
    if (!text) return
    setLoading(true)
    try {
      const c = await api.addComment(post.id, text, name)
      setComments(prev => [...prev, c])
      setCommentText('')
      localStorage.setItem('sarika_guest_name', name)
    } catch {}
    setLoading(false)
  }

  const handleDeleteComment = async (cid) => {
    if (!isAdmin) return
    try {
      await api.deleteComment(post.id, cid)
      setComments(prev => prev.filter(c => c.id !== cid))
    } catch {}
  }

  return (
    <article className="post-card card">
      {/* Media */}
      {post.type === 'video'
        ? <video src={post.url} controls playsInline style={{ width: '100%', maxHeight: 400, background: '#000' }} />
        : <img src={post.url} alt={post.caption || ''} loading="lazy" />
      }

      {/* Reactions row */}
      <div className="post-actions">
        {REACTIONS.map(({ type, emoji }) => (
          <button key={type} className="reaction-btn" onClick={() => handleReact(type)}>
            <span className="emoji">{emoji}</span>
            <span>{reactions[type] || 0}</span>
          </button>
        ))}
        <button
          className="reaction-btn"
          style={{ marginLeft: 'auto', fontSize: '0.8rem', gap: '0.25rem' }}
          onClick={() => setShowComments(s => !s)}
        >
          💬 <span>{comments.length}</span>
        </button>
        {isAdmin && (
          <button className="reaction-btn" onClick={() => onDelete(post.id)} style={{ color: 'rgba(231,76,60,0.7)' }}>
            <TrashIcon style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>

      <p className="post-author">{post.author || 'Guest'}</p>
      {post.caption && <p className="post-caption">{post.caption}</p>}
      <p className="post-time">{timeAgo(post.created_at)}</p>

      {/* Comments */}
      {showComments && (
        <div style={{ padding: '0 0.9rem 1rem', borderTop: '1px solid var(--dark-border)' }}>
          <div style={{ paddingTop: '0.75rem' }}>
            {comments.map(c => (
              <div key={c.id} className="comment-item">
                <div className="comment-avatar">{(c.name || 'G')[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="comment-name">{c.name || 'Guest'}</div>
                  <div className="comment-text">{c.text}</div>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(231,76,60,0.6)', padding: 0 }}>
                    <TrashIcon style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Comment form */}
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {!user && (
              <input
                className="input"
                placeholder="Your name"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                placeholder="Add a comment…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button className="btn btn-gold btn-sm" onClick={handleComment} disabled={loading}>
                {loading ? '…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
