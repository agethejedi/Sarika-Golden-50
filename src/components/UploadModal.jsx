import { useState, useRef } from 'react'
import { api } from '../lib/api.js'

export function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [name, setName] = useState(localStorage.getItem('sarika_guest_name') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState('photo')
  const fileRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    const isVideo = f.type.startsWith('video/')
    setType(isVideo ? 'video' : 'photo')
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async () => {
    if (!file) { setError('Please select a file'); return }
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('caption', caption)
      form.append('author', name.trim() || 'Guest')
      form.append('type', type)
      localStorage.setItem('sarika_guest_name', name)
      const post = await api.createPost(form)
      onSuccess(post)
      onClose()
    } catch (e) {
      setError(e.message || 'Upload failed')
    }
    setLoading(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="label">Share a Moment</p>

        {/* File picker */}
        {!preview ? (
          <div
            className="upload-area"
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📷</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Tap to upload a photo or video
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Videos limited to 20 seconds
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              capture="environment"
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            {type === 'video'
              ? <video src={preview} controls style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 260 }} />
              : <img src={preview} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
            }
            <button
              onClick={() => { setFile(null); setPreview(null) }}
              style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
          <input className="input" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <textarea className="textarea" placeholder="Caption (optional)…" value={caption} onChange={e => setCaption(e.target.value)} rows={2} />
          {error && <p style={{ color: '#e74c3c', fontSize: '0.8rem' }}>{error}</p>}
          <button className="btn btn-gold btn-full" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Uploading…' : '✦ Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
