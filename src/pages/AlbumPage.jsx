import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { PostCard } from '../components/PostCard.jsx'
import { UploadModal } from '../components/UploadModal.jsx'
import { useToast } from '../hooks/useToast.js'
import { PlusIcon } from '../components/Icons.jsx'

export function AlbumPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [view, setView] = useState('feed') // 'feed' | 'grid'
  const { toast, showToast } = useToast()

  useEffect(() => {
    api.getPosts()
      .then(data => setPosts(data.filter(p => p.type !== 'video')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this post?')) return
    try {
      await api.deletePost(id)
      setPosts(prev => prev.filter(p => p.id !== id))
      showToast('Post deleted')
    } catch {}
  }

  const handleUploadSuccess = (post) => {
    setPosts(prev => [post, ...prev])
    showToast('✦ Your moment has been shared')
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1rem 0.75rem', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <p className="font-display" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--gold-mid)', textTransform: 'uppercase' }}>Celebration</p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 300, lineHeight: 1 }}>Album</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--dark-surface)', borderRadius: 8, padding: 2 }}>
            {['feed', 'grid'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  background: view === v ? 'var(--dark-card)' : 'transparent',
                  border: view === v ? '1px solid var(--dark-border-strong)' : '1px solid transparent',
                  borderRadius: 6, padding: '4px 10px',
                  color: view === v ? 'var(--gold-mid)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.65rem', fontFamily: "'Cinzel', serif", letterSpacing: '0.06em'
                }}
              >
                {v === 'feed' ? '≡' : '⊞'}
              </button>
            ))}
          </div>

          <button
            className="btn btn-gold btn-sm"
            onClick={() => setShowUpload(true)}
            style={{ gap: '0.3rem', paddingLeft: '0.75rem', paddingRight: '0.9rem' }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> Photo
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 280 }} />)}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            No photos yet.<br />Be the first to share a moment.
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="photo-grid" style={{ marginTop: 2 }}>
          {posts.map(p => (
            <div key={p.id} className="photo-item">
              <img src={p.url} alt={p.caption || ''} loading="lazy" />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 2 }}>
          {posts.map(p => (
            <PostCard key={p.id} post={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
