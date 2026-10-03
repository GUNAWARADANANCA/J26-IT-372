// Thin fetch wrapper: adds the bearer token, parses JSON and turns API errors
// ({detail: {code, message, problems}} or {detail: "text"}) into ApiError.
const BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'pa_token'

export class ApiError extends Error {
  constructor(status, detail) {
    const msg = typeof detail === 'string' ? detail : detail?.message || JSON.stringify(detail)
    super(msg)
    this.status = status
    this.code = detail?.code
    this.problems = detail?.problems || []
    this.detail = detail
  }
}

export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ } },
}

export async function api(path, { method = 'GET', body, headers = {}, raw = false, form } = {}) {
  const h = { ...headers }
  const t = token.get()
  if (t) h.Authorization = `Bearer ${t}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: payload })
  if (raw) return res
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (res.status === 401 && t) {
    token.set(null)
    window.dispatchEvent(new Event('pa-logout'))
  }
  if (!res.ok && res.status !== 202) {
    // Scan endpoints answer with a decision body instead of {detail}
    throw new ApiError(res.status, data?.detail ?? (data?.reasons ? { message: data.reasons.map(r => r.message).join('; '), code: data.reasons[0]?.code } : data))
  }
  return data
}

export async function downloadFile(path, filename) {
  const res = await api(path, { raw: true })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export async function imageUrl(imageId) {
  const res = await api(`/api/intake/images/${imageId}`, { raw: true })
  if (!res.ok) throw new ApiError(res.status, 'image not available')
  return URL.createObjectURL(await res.blob())
}
