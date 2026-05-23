import { Link, useLocation } from 'react-router-dom'
import { HomeIcon, AlbumIcon, VideoIcon, ShieldIcon } from './Icons.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

export function BottomNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()

  const nav = [
    { to: '/',        label: 'Home',     Icon: HomeIcon  },
    { to: '/album',   label: 'Album',    Icon: AlbumIcon },
    { to: '/videos',  label: 'Messages', Icon: VideoIcon },
  ]

  if (user?.role === 'admin' || user?.role === 'sarika') {
    nav.push({ to: '/admin', label: user?.role === 'sarika' ? 'Approvals' : 'Admin', Icon: ShieldIcon })
  }

  return (
    <nav className="bottom-nav">
      {nav.map(({ to, label, Icon }) => (
        <Link key={to} to={to} className={`nav-item${pathname === to ? ' active' : ''}`}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  )
}
