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

export async function getFieldOptions() {
  return request('/api/field-options')
}

export function createFieldOption(field, value) {
  return request('/api/field-options', {
    method: 'POST',
    body: JSON.stringify({ field, value }),
  })
}

export function getAttendanceSettings() {
  return request('/api/settings/attendance')
}

export function saveAttendanceSettings(settings) {
  return request('/api/settings/attendance', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function checkAttendanceLocation(latitude, longitude) {
  return request('/api/attendance/location', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  })
}

export function scanAttendance({ employeeId, latitude, longitude, accuracy }) {
  return request('/api/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy,
    }),
  })
}

export function importExcel(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/api/import/excel`)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.({ phase: 'upload', percent: null })
        return
      }
      onProgress?.({
        phase: 'upload',
        percent: Math.round((event.loaded / event.total) * 100),
      })
    }
    xhr.upload.onload = () => {
      onProgress?.({ phase: 'save', percent: null })
    }
    xhr.onload = () => {
      let payload = null
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        payload = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload)
        return
      }
      const detail = payload?.detail
      reject(
        new Error(
          typeof detail === 'string' ? detail : `Import failed (${xhr.status})`,
        ),
      )
    }
    xhr.onerror = () => reject(new Error('Import failed'))
    const body = new FormData()
    body.append('file', file)
    xhr.send(body)
  })
}

export async function exportExcel(doctype, onProgress) {
  const response = await fetch(`${API}/api/export/${doctype}`)
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`)
  }
  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body?.getReader()
  let blob
  if (!reader) {
    blob = await response.blob()
    onProgress?.({ phase: 'download', percent: 100 })
  } else {
    const chunks = []
    let loaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.byteLength
      onProgress?.({
        phase: 'download',
        percent: total
          ? Math.min(100, Math.round((loaded / total) * 100))
          : null,
      })
    }
    blob = new Blob(chunks)
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download =
    doctype === 'employee' ? 'employees.xlsx' : 'daily_kpi_logs.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}
