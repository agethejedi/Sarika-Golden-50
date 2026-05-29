import { useEffect } from 'react'

export function Lightbox({ url, caption, onClose }) {
  // Close on escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          color: '#fff',
          fontSize: '1.2rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 501,
        }}
      >
        ×
      </button>

      {/* Image */}
      <img
        src={url}
        alt={caption || ''}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 8rem)',
          objectFit: 'contain',
          borderRadius: '4px',
          boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        }}
      />

      {/* Caption */}
      {caption && (
        <p
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: '1rem',
            color: 'var(--gold-pale)',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1rem',
            textAlign: 'center',
            maxWidth: 400,
            lineHeight: 1.5,
          }}
        >
          {caption}
        </p>
      )}

      {/* Tap anywhere to close hint */}
      <p style={{
        position: 'absolute',
        bottom: '1.5rem',
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.7rem',
        fontFamily: "'Cinzel', serif",
        letterSpacing: '0.1em',
      }}>
        TAP ANYWHERE TO CLOSE
      </p>
    </div>
  )
}
