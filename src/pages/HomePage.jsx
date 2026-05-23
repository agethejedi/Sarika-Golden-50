import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CrownIcon } from '../components/Icons.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

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
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Hero */}
      <div className="crown-header" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '5rem', paddingBottom: '3rem' }}>
        <CrownIcon className="crown-icon" />

        <p className="font-display" style={{ fontSize: '0.65rem', letterSpacing: '0.22em', color: 'var(--gold-mid)', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
          A Golden Birthday Experience
        </p>

        <h1 className="sarika-name" style={{ fontStyle: 'italic' }}>Sarika</h1>

        <div className="golden-50" style={{ margin: '0.75rem 0' }}>
          Golden &nbsp;•&nbsp; 50
        </div>

        <div className="khmer-name" style={{ marginBottom: '2rem' }}>
          សារិកា
        </div>

        <div className="gold-line" style={{ width: '60px', margin: '0.5rem auto 2rem' }} />

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6, marginBottom: '2.5rem' }}>
          A private album, memory wall, and celebration companion.
        </p>

        <Link to="/album" className="btn btn-gold" style={{ padding: '0.75rem 2.5rem', fontSize: '0.75rem' }}>
          Open Album
        </Link>
      </div>

      {/* Bottom login area */}
      <div style={{ padding: '1.5rem', textAlign: 'center' }}>
        {user ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Signed in as <span style={{ color: 'var(--gold-mid)' }}>{user.role}</span>
          </p>
        ) : (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}
            onClick={() => setShowLogin(true)}
          >
            Admin / Sarika Login
          </button>
        )}
      </div>

      {/* Login modal */}
      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <p className="label" style={{ marginBottom: '1.25rem' }}>Private Access</p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {['admin', 'sarika'].map(r => (
                <button
                  key={r}
                  className={`btn ${role === r ? 'btn-gold' : 'btn-ghost'}`}
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
            <button className="btn btn-gold btn-full" style={{ marginTop: '1rem' }} onClick={handleLogin} disabled={loading}>
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
