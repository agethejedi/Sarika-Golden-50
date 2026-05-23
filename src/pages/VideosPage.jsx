import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import { PostCard } from '../components/PostCard.jsx'
import { useToast } from '../hooks/useToast.js'

export function VideosPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRecord, setShowRecord] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => {
    api.getPosts()
      .then(data => setPosts(data.filter(p => p.type === 'video')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this video message?')) return
    try {
      await api.deletePost(id)
      setPosts(prev => prev.filter(p => p.id !== id))
      showToast('Message deleted')
    } catch {}
  }

  const handleRecordSuccess = (post) => {
    setPosts(prev => [post, ...prev])
    showToast('💫 Your message has been shared')
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 1rem 0.75rem', borderBottom: '1px solid var(--dark-border)' }}>
        <div>
          <p className="font-display" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', color: 'var(--gold-mid)', textTransform: 'uppercase' }}>Video</p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 300, lineHeight: 1 }}>Messages</h2>
        </div>
        <button className="btn btn-gold btn-sm" onClick={() => setShowRecord(true)}>
          🎥 Record
        </button>
      </div>

      <div style={{ padding: '0.75rem', background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
          Leave Sarika a video message — up to 20 seconds
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1,2].map(i => <div key={i} className="shimmer" style={{ height: 240 }} />)}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            No video messages yet.<br />Record one for Sarika's golden day.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 2 }}>
          {posts.map(p => (
            <PostCard key={p.id} post={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showRecord && (
        <RecordModal
          onClose={() => setShowRecord(false)}
          onSuccess={handleRecordSuccess}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ── RECORD MODAL ─────────────────────────────────────────────────────── */

function RecordModal({ onClose, onSuccess }) {
  const videoRef = useRef()
  const mediaRef = useRef()
  const chunksRef = useRef([])
  const timerRef = useRef()

  const [phase, setPhase] = useState('idle') // idle | preview | countdown | recording | review
  const [stream, setStream] = useState(null)
  const [blob, setBlob] = useState(null)
  const [timeLeft, setTimeLeft] = useState(20)
  const [name, setName] = useState(localStorage.getItem('sarika_guest_name') || '')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        videoRef.current.play()
      }
      setPhase('preview')
    } catch {
      setError('Camera access denied')
    }
  }

  const startRecording = () => {
    if (!stream) return
    chunksRef.current = []
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' })
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const b = new Blob(chunksRef.current, { type: 'video/webm' })
      setBlob(b)
      const url = URL.createObjectURL(b)
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current.src = url
        videoRef.current.controls = true
      }
      setPhase('review')
      stream.getTracks().forEach(t => t.stop())
    }
    mediaRef.current = mr

    setPhase('countdown')
    let count = 3
    const cd = setInterval(() => {
      count--
      setTimeLeft(count)
      if (count <= 0) {
        clearInterval(cd)
        mr.start()
        setPhase('recording')
        setTimeLeft(20)
        timerRef.current = setInterval(() => {
          setTimeLeft(t => {
            if (t <= 1) {
              clearInterval(timerRef.current)
              mr.stop()
              return 0
            }
            return t - 1
          })
        }, 1000)
      }
    }, 1000)
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
  }

  const handleSubmit = async () => {
    if (!blob) return
    setLoading(true)
    setError('')
    try {
      const file = new File([blob], 'message.webm', { type: 'video/webm' })
      const form = new FormData()
      form.append('file', file)
      form.append('author', name.trim() || 'Guest')
      form.append('caption', caption)
      form.append('type', 'video')
      localStorage.setItem('sarika_guest_name', name)
      const post = await api.createPost(form)
      onSuccess(post)
      onClose()
    } catch (e) {
      setError(e.message || 'Upload failed')
    }
    setLoading(false)
  }

  const reset = () => {
    if (stream) stream.getTracks().forEach(t => t.stop())
    setBlob(null); setPhase('idle'); setTimeLeft(20)
    if (videoRef.current) { videoRef.current.src = ''; videoRef.current.srcObject = null; videoRef.current.controls = false }
  }

  useEffect(() => () => {
    if (stream) stream.getTracks().forEach(t => t.stop())
    clearInterval(timerRef.current)
  }, [stream])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="label" style={{ marginBottom: '1rem' }}>Record a Message</p>

        {/* Video preview */}
        <div style={{ position: 'relative', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem', minHeight: 200 }}>
          <video ref={videoRef} playsInline muted={phase !== 'review'} style={{ width: '100%', display: 'block', maxHeight: 280 }} />

          {phase === 'idle' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-gold" onClick={startCamera}>Enable Camera</button>
            </div>
          )}

          {phase === 'countdown' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '5rem', color: 'var(--gold-light)', fontFamily: "'Cinzel', serif", textShadow: '0 0 20px rgba(201,168,76,0.5)' }}>{timeLeft}</span>
            </div>
          )}

          {phase === 'recording' && (
            <div style={{ position: 'absolute', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.6)', borderRadius: 60, padding: '4px 12px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e74c3c', animation: 'pulse-record 1s infinite' }} />
              <span style={{ color: '#fff', fontSize: '0.75rem', fontFamily: "'Cinzel', serif" }}>{timeLeft}s</span>
            </div>
          )}
        </div>

        {error && <p style={{ color: '#e74c3c', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>}

        {/* Controls */}
        {phase === 'preview' && (
          <button className="btn btn-gold btn-full" onClick={startRecording}>Start Recording</button>
        )}

        {phase === 'recording' && (
          <button className="btn btn-danger btn-full" onClick={stopRecording}>■ Stop Early</button>
        )}

        {phase === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reset}>Re-record</button>
              <button className="btn btn-gold" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Sending…' : '✦ Send Message'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
