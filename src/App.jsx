import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import { BottomNav } from './components/BottomNav.jsx'
import { HomePage } from './pages/HomePage.jsx'
import { AlbumPage } from './pages/AlbumPage.jsx'
import { VideosPage } from './pages/VideosPage.jsx'
import { AdminPage } from './pages/AdminPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"       element={<HomePage />} />
          <Route path="/album"  element={<AlbumPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/admin"  element={<AdminPage />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
    </AuthProvider>
  )
}
