import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('sarika_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const login = (userData, token) => {
    localStorage.setItem('sarika_user', JSON.stringify(userData))
    localStorage.setItem('sarika_token', token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('sarika_user')
    localStorage.removeItem('sarika_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin', isSarika: user?.role === 'sarika' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
