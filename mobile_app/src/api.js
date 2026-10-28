// Minimal API client for the PostAssist backend.
import * as SecureStore from 'expo-secure-store'

const KEYS = { server: 'pa_server', token: 'pa_token', user: 'pa_user' }

export async function loadSession() {
  const [server, token, user] = await Promise.all([
    SecureStore.getItemAsync(KEYS.server), SecureStore.getItemAsync(KEYS.token), SecureStore.getItemAsync(KEYS.user),
  ])
  return { server: server || '', token, user: user ? JSON.parse(user) : null }
}

export async function saveSession({ server, token, user }) {
  if (server !== undefined) await SecureStore.setItemAsync(KEYS.server, server)
  if (token) await SecureStore.setItemAsync(KEYS.token, token)
  else if (token === null) await SecureStore.deleteItemAsync(KEYS.token)
  if (user) await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user))
}

export class ApiError extends Error {
  constructor(status, body) {
    const detail = body?.detail
    super(typeof detail === 'string' ? detail : detail?.message || body?.reasons?.[0]?.message || `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

export async function request(session, path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${session.server.replace(/\/$/, '')}${path}`, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok && res.status !== 202) throw new ApiError(res.status, data)
    return data
  } finally {
    clearTimeout(timer)
  }
}

export async function login(server, username, password) {
  const res = await request({ server }, '/api/auth/login', { method: 'POST', body: { username, password } })
  const session = { server, token: res.token, user: res.user }
  const statuses = await request(session, '/api/scans/statuses')
  session.user = { ...res.user, statuses: statuses.statuses }
  await saveSession(session)
  return session
}
