import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, token } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(token.get()))

  useEffect(() => {
    if (!token.get()) return
    api('/api/auth/me').then(setUser).catch(() => token.set(null)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('pa-logout', onLogout)
    return () => window.removeEventListener('pa-logout', onLogout)
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await api('/api/auth/login', { method: 'POST', body: { username, password } })
    token.set(res.token)
    const me = await api('/api/auth/me')
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => { token.set(null); setUser(null) }, [])

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export const can = (user, ...roles) => Boolean(user) && (user.role === 'admin' || roles.includes(user.role))
