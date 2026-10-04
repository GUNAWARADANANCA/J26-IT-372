/**
 * MongoDB-backed repository. The Python API on port 8000 owns the data.
 * In dev, Vite proxies /api and /health to that server.
 */

const API = import.meta.env.VITE_API_URL ?? ''

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (response.status === 204) return null
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const detail = body?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  return body
}

export async function list(doctype, { search = '', filters = {} } = {}) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return request(`/api/${doctype}${query ? `?${query}` : ''}`)
}

export async function get(doctype, name) {
  const response = await fetch(
    `${API}/api/${doctype}/${encodeURIComponent(name)}`,
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json()
}

export function create(doctype, doc) {
  return request(`/api/${doctype}`, {
    method: 'POST',
    body: JSON.stringify(doc),
  })
}

export function update(doctype, name, doc) {
  return request(`/api/${doctype}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(doc),
  })
}

export function remove(doctype, name) {
  return request(`/api/${doctype}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export async function count(doctype) {
  const rows = await list(doctype)
  return rows.length
}
