import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

// ── Upload your hero image to R2 and paste the public URL here ──────────
const HERO_IMAGE = 'https://pub-67f4eb0e92314b19892e15bb041c1925.r2.dev/4e46e5c2-9e57-46d7-a3f4-6b8059ff352b.png'

export function HomePage() {
  const { user, login } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { token, user: u } = await api.login(password, role)
      login(u, token)
      setShowLogin(false)
    } catch (e) {
      setError('Incorrect password')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0D0B08' }}>

      {/* ── FULL BLEED HERO ─────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: '100vh',
        minHeight: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}>

        {/* Hero image */}
        <img
          src={HERO_IMAGE}
          alt="Sarika"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />

        {/* Top gradient — subtle dark vignette */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '35%',
          background: 'linear-gradient(to bottom, rgba(13,11,8,0.7) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Bottom gradient — strong so text is legible */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '65%',
          background: 'linear-gradient(to top, rgba(13,11,8,0.98) 0%, rgba(13,11,8,0.85) 40%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* ── TEXT OVERLAY ──────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          padding: '0 1.5rem 2.5rem',
          paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))',
        }}>

          {/* Subtitle top */}
          <p style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '0.58rem',
            letterSpacing: '0.28em',
            color: 'var(--gold-mid)',
            textTransform: 'uppercase',
            marginBottom: '0.6rem',
            opacity: 0.9,
          }}>
            A Golden Birthday Experience
          </p>

          {/* Name */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(4rem, 14vw, 6rem)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#fff',
            lineHeight: 1,
            marginBottom: '0.3rem',
            textShadow: '0 2px 30px rgba(0,0,0,0.5)',
          }}>
            Sarika
          </h1>

          {/* Golden 50 */}
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '1rem',
            letterSpacing: '0.2em',
            color: 'var(--gold-mid)',
            marginBottom: '0.6rem',
          }}>
            Golden &nbsp;•&nbsp; 50
          </div>

          {/* Khmer name */}
          <div style={{
            fontFamily: "'Noto Serif Khmer', serif",
            fontSize: '1.4rem',
            color: 'var(--gold-light)',
            marginBottom: '1rem',
            opacity: 0.95,
          }}>
            សារិកា
          </div>

          {/* Gold divider */}
          <div style={{
            width: 60,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--gold-mid), transparent)',
            margin: '0 auto 1rem',
          }} />

          {/* Tagline from image */}
          <p style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '0.95rem',
            letterSpacing: '0.12em',
            color: 'var(--gold-pale)',
            marginBottom: '0.25rem',
            textTransform: 'uppercase',
          }}>
            Embrace Legacy
          </p>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '0.8rem',
            letterSpacing: '0.15em',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            textTransform: 'uppercase',
          }}>
            Discover the Timeless Beauty of Cambodia
          </p>

          {/* Lotus */}
          <div style={{ fontSize: '1.2rem', marginBottom: '1.75rem', opacity: 0.7 }}>🪷</div>

          {/* CTA */}
          <Link
            to="/album"
            className="btn btn-gold"
            style={{ padding: '0.85rem 3rem', fontSize: '0.72rem', letterSpacing: '0.14em' }}
          >
            Open Album
          </Link>

          {/* Login link */}
          <div style={{ marginTop: '1.5rem' }}>
            {user ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Signed in as <span style={{ color: 'var(--gold-mid)' }}>{user.role}</span>
              </p>
            ) : (
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.58rem', letterSpacing: '0.1em', opacity: 0.7 }}
                onClick={() => setShowLogin(true)}
              >
                Admin / Sarika Login
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── LOGIN MODAL ──────────────────────────────────────────────── */}
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <p className="label" style={{ marginBottom: '1.25rem' }}>Private Access</p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {['admin', 'sarika'].map(r => (
                <button
                  key={r}
                  className={'btn ' + (role === r ? 'btn-gold' : 'btn-ghost')}
                  style={{ flex: 1 }}
                  onClick={() => setRole(r)}
                >
                  {r === 'admin' ? '⚙️ Admin (Ron)' : '👑 Sarika'}
                </button>
              ))}
            </div>

            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            {error && <p style={{ color: '#e74c3c', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}
            <button
              className="btn btn-gold btn-full"
              style={{ marginTop: '1rem' }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



