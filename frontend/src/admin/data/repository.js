/**
 * MongoDB-backed repository. The Python API on port 8000 owns the data.
 * In dev, Vite proxies /api and /health to that server.
 */

const API = import.meta.env.VITE_API_URL ?? ''

let csrfToken = ''

export function setCsrfToken(token) {
  csrfToken = token || ''
}

async function requestOnce(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (csrfToken && method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = csrfToken
  }
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers,
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
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return body
}

async function request(path, options = {}) {
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestOnce(path, options)
    } catch (error) {
      lastError = error
      const lost = error.status === 503 || /temporarily unreachable/i.test(error.message || '')
      if (!lost || attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)))
    }
  }
  throw lastError
}

export function dailyAttendance({ date = '', search = '' } = {}) {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (search.trim()) params.set('search', search.trim())
  const query = params.toString()
  return request(`/api/attendance/daily${query ? `?${query}` : ''}`)
}

export function openAttendanceDay(date) {
  return request('/api/attendance/daily/open', {
    method: 'POST',
    body: JSON.stringify({ date }),
  })
}

export function closeAttendanceDay(date, confirm) {
  return request('/api/attendance/daily/close', {
    method: 'POST',
    body: JSON.stringify({ date, confirm }),
  })
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
    { credentials: 'include' },
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

export function getDoorToken() {
  return request('/api/attendance/door-token')
}

export function getAttendanceRoster() {
  return request('/api/attendance/roster')
}

export function checkAttendanceLocation(latitude, longitude) {
  return request('/api/attendance/location', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  })
}

export function scanAttendance({ employeeId, latitude, longitude, accuracy, doorToken }) {
  return request('/api/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy,
      door_token: doorToken,
    }),
  })
}

export function deleteEntitlement(module, id) {
  return request(`/api/entitlements/${module}/${id}`, { method: 'DELETE' })
}

export function getPayroll(month) {
  return request(`/api/payroll?month=${encodeURIComponent(month)}`)
}

export function getProductivity(employeeId, week) {
  const params = new URLSearchParams()
  if (week) params.set('week', week)
  const query = params.toString()
  return request(
    `/api/productivity/${encodeURIComponent(employeeId)}${query ? `?${query}` : ''}`,
  )
}

export function getKpiForecasts(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return request(`/api/kpi/forecasts${query ? `?${query}` : ''}`)
}

export function getKpiForecastSummary() {
  return request('/api/kpi/forecasts/summary')
}

export function getCoach(employeeId, week) {
  const params = new URLSearchParams()
  if (week) params.set('week', week)
  const query = params.toString()
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/coach${query ? `?${query}` : ''}`)
}

export function askCoach(employeeId, week, question) {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/coach/ask`, {
    method: 'POST',
    body: JSON.stringify({ week, question }),
  })
}

export function followCoach(employeeId, recommendationId, status) {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/coach/follow-up`, {
    method: 'POST',
    body: JSON.stringify({ recommendation_id: recommendationId, status }),
  })
}

export function getPostalKpiDashboard({ employeeId = '', routeId = '', year = '' } = {}) {
  const params = new URLSearchParams()
  if (employeeId) params.set('employee_id', employeeId)
  if (routeId) params.set('route_id', routeId)
  if (year) params.set('year', year)
  const query = params.toString()
  return request(`/api/postal-kpi/dashboard${query ? `?${query}` : ''}`)
}

export function getPowerBiStatus() {
  return request('/api/powerbi/status')
}

export function getPowerBiEmbed(page) {
  return request('/api/powerbi/embed', {
    method: 'POST',
    body: JSON.stringify({ page }),
  })
}

export function getKpiForecast(employeeId) {
  return request(`/api/kpi/forecasts/${encodeURIComponent(employeeId)}`)
}

export function generateKpiForecasts(week) {
  return request('/api/kpi/forecasts/generate', {
    method: 'POST',
    body: JSON.stringify(week ? { week } : {}),
  })
}

export function saveMeasuredForecast(employeeId, week) {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/forecasts`, {
    method: 'POST',
    body: JSON.stringify({ week }),
  })
}

export function saveScenarioForecast(employeeId, scenario) {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/forecasts`, {
    method: 'POST',
    body: JSON.stringify({ source: 'scenario', scenario }),
  })
}

export function login(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST', body: '{}' })
}

export function currentUser() {
  return request('/api/auth/me')
}

export function getForecastMonitoring({ employeeId = '', periodFrom = '', periodTo = '', status = 'all' } = {}) {
  const params = new URLSearchParams()
  if (employeeId) params.set('employee_id', employeeId)
  if (periodFrom) params.set('period_from', periodFrom)
  if (periodTo) params.set('period_to', periodTo)
  if (status) params.set('status', status)
  return request(`/api/forecast-monitoring?${params.toString()}`)
}

export function simulateProductivity(employeeId, scenarios) {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ scenarios }),
  })
}

export function getPromotionReview() {
  return request('/api/promotion-review')
}

export function getAllocation(date, checklist) {
  return request('/api/allocation/review', {
    method: 'POST',
    body: JSON.stringify({ date, checklist }),
  })
}

export function approveAllocation(date, checklist) {
  return request('/api/allocation/approve', {
    method: 'POST',
    body: JSON.stringify({ date, checklist }),
  })
}

export function confirmOvertime(date, checklist) {
  return request('/api/allocation/overtime', {
    method: 'POST',
    body: JSON.stringify({ date, checklist }),
  })
}

export function getGratuity() {
  return request('/api/gratuity')
}

export function saveGratuity() {
  return request('/api/gratuity', { method: 'POST' })
}

export function listEntitlements(module) {
  return request(`/api/entitlements/${module}`)
}

export function createEntitlement(module, doc) {
  return request(`/api/entitlements/${module}`, {
    method: 'POST',
    body: JSON.stringify(doc),
  })
}

export function importExcel(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/api/import/excel`)
    xhr.withCredentials = true
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    }
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
  const response = await fetch(`${API}/api/export/${doctype}`, {
    credentials: 'include',
  })
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
