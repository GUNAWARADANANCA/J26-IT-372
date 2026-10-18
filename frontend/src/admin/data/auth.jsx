import { createContext, useContext, useEffect, useState } from 'react'
import { currentUser, login as loginRequest, logout as logoutRequest, setCsrfToken } from './repository'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    currentUser()
      .then((session) => {
        if (cancelled) return
        setCsrfToken(session.csrf_token)
        setUser(session)
      })
      .catch(() => {
        if (!cancelled) {
          setCsrfToken('')
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function login(username, password) {
    const session = await loginRequest(username, password)
    setCsrfToken(session.csrf_token)
    setUser(session)
    return session
  }

  async function logout() {
    await logoutRequest()
    setCsrfToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
