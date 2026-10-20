/**
 * MongoDB-backed repository. The Python API on port 8000 owns the data.
 * In dev, Vite proxies /api and /health to that server.
 */

const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

let csrfToken = ''

export function setCsrfToken(token) {
  csrfToken = token || ''
}

export function getCsrfToken() {
  return csrfToken
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API}/health`, { credentials: 'include' })
    if (res.ok) return await res.json()
  } catch {
    try {
      const res2 = await fetch(`${API}/api/health`, { credentials: 'include' })
      if (res2.ok) return await res2.json()
    } catch {}
  }
  return { ok: false, error: 'FastAPI server not responding' }
}

export async function ensureCsrfToken() {
  if (csrfToken) return csrfToken
  try {
    const session = await currentUser()
    if (session?.csrf_token) {
      csrfToken = session.csrf_token
      return csrfToken
    }
  } catch {
    // Ignore error
  }
  return csrfToken || ''
}

async function requestOnce(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const token = await ensureCsrfToken()
    if (token) {
      headers['X-CSRF-Token'] = token
    }
  }

  let response
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    })
  } catch (networkError) {
    if (networkError.name === 'AbortError') {
      const err = new Error('The request timed out or was cancelled.')
      err.isTimeout = true
      throw err
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const err = new Error('Network connection is offline. Please check your connectivity.')
      err.isNetwork = true
      throw err
    }
    const targetDesc = API ? `${API}${path}` : `FastAPI backend (http://127.0.0.1:8000${path} via proxy)`
    const err = new Error(
      `Unable to connect to the Post-Assist API server at ${targetDesc}. Please ensure the FastAPI backend is running and listening on port 8000.`
    )
    err.isNetwork = true
    err.original = networkError
    throw err
  }

  if (response.status === 204) return null
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    let message = ''
    if (response.status === 401) {
      message = typeof body?.detail === 'string'
        ? body.detail
        : 'Your session has expired or is invalid. Please sign in again.'
    } else if (response.status === 403) {
      message = typeof body?.detail === 'string'
        ? body.detail
        : 'Permission denied or security token mismatch.'
    } else if (response.status === 404) {
      message = typeof body?.detail === 'string' ? body.detail : `Resource not found (${path})`
    } else if (response.status === 502 || response.status === 504) {
      message = 'Gateway error or backend proxy timeout. The FastAPI service may be restarting.'
    } else if (response.status === 503) {
      message = typeof body?.detail === 'string' ? body.detail : 'The database is temporarily unreachable. Please retry.'
    } else if (typeof body?.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body?.detail)) {
      message = body.detail.map((e) => e.msg || e.message || JSON.stringify(e)).join('; ')
    } else {
      message = `Request failed (${response.status} ${response.statusText || ''})`
    }
    const error = new Error(message)
    error.status = response.status
    error.body = body
    throw error
  }
  return body
}

const inFlightRequests = new Map()
const responseCache = new Map()
const CACHE_TTL_MS = 2500 // 2.5s deduplication and burst cache

export function invalidateCache() {
  responseCache.clear()
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const isGet = method === 'GET'
  const isFresh = Boolean(options.fresh)
  const cacheKey = `${method}:${path}`

  // Any mutation (POST, PUT, PATCH, DELETE) invalidates the read cache immediately
  if (!isGet) {
    responseCache.clear()
  } else if (!isFresh) {
    const cached = responseCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)
    }
  }

  const execution = (async () => {
    let lastError = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const data = await requestOnce(path, options)
        if (isGet) {
          responseCache.set(cacheKey, { timestamp: Date.now(), data })
        }
        return data
      } catch (error) {
        lastError = error
        const lost = error.status === 503 || /temporarily unreachable/i.test(error.message || '')
        if (!lost || attempt === 2) throw error
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)))
      }
    }
    throw lastError
  })()

  if (isGet) {
    inFlightRequests.set(cacheKey, execution)
    execution.finally(() => {
      inFlightRequests.delete(cacheKey)
    })
  }

  return execution
}

export function dailyAttendance({
  date = '',
  search = '',
  type = '',
  status = '',
  office = '',
  includeAbsent = true,
} = {}) {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (search.trim()) params.set('search', search.trim())
  if (type && type !== 'All') params.set('type', type)
  if (status && status !== 'All') params.set('status', status)
  if (office && office !== 'All') params.set('office', office)
  if (includeAbsent !== undefined) params.set('include_absent', String(includeAbsent))
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

export function getDoorToken({ port = '', locationId = '' } = {}) {
  const params = new URLSearchParams()
  const activePort = port || (typeof window !== 'undefined' ? window.location.port : '')
  if (activePort) params.set('port', activePort)
  if (locationId) params.set('location_id', locationId)
  const query = params.toString()
  return request(`/api/attendance/door-token${query ? `?${query}` : ''}`)
}

export function verifyAttendanceToken({ doorToken, qrLocationId }) {
  return request('/api/attendance/verify-token', {
    method: 'POST',
    body: JSON.stringify({
      door_token: doorToken,
      qr_location_id: qrLocationId,
    }),
  })
}

export function getAttendanceLocationInfo(locationId = '') {
  const params = new URLSearchParams()
  if (locationId) params.set('location_id', locationId)
  const query = params.toString()
  return request(`/api/attendance/location-info${query ? `?${query}` : ''}`)
}

export function validateAttendanceLocation({ latitude, longitude, accuracy, qrLocationId }) {
  return request('/api/attendance/validate-location', {
    method: 'POST',
    body: JSON.stringify({
      latitude,
      longitude,
      accuracy,
      qr_location_id: qrLocationId,
    }),
  })
}

export function manageQrLocation({ action, officeName, officeId }) {
  return request('/api/attendance/qr-manage', {
    method: 'POST',
    body: JSON.stringify({
      action,
      office_name: officeName,
      office_id: officeId,
    }),
  })
}

export function getAttendanceRoster() {
  return request('/api/attendance/roster')
}

export function resetEmployeeAttendance(employeeId, date = '') {
  return request('/api/attendance/reset', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      date: date || undefined,
    }),
  })
}

export function checkAttendanceLocation(latitude, longitude, accuracy = null, qrLocationId = '') {
  return request('/api/attendance/location', {
    method: 'POST',
    body: JSON.stringify({
      latitude,
      longitude,
      accuracy,
      qr_location_id: qrLocationId || undefined,
    }),
  })
}

export function scanAttendance({
  employeeId,
  latitude,
  longitude,
  accuracy,
  doorToken,
  qrLocationId,
  action,
  deviceInfo,
}) {
  return request('/api/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy,
      door_token: doorToken,
      qr_location_id: qrLocationId || undefined,
      action: action || undefined,
      device_info: deviceInfo || undefined,
    }),
  })
}

export function verifyEmployeeAttendanceIdentity({ employeeId, verificationCode, doorToken, deviceInfo }) {
  return request('/api/attendance/verify-employee', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      verification_code: verificationCode,
      door_token: doorToken || undefined,
      device_info: deviceInfo || undefined,
    }),
  })
}

export function checkInAttendance({
  employeeId,
  latitude,
  longitude,
  accuracy,
  doorToken,
  qrLocationId,
  verificationToken,
  deviceInfo,
}) {
  return request('/api/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy,
      door_token: doorToken || undefined,
      qr_location_id: qrLocationId || undefined,
      verification_token: verificationToken || undefined,
      device_info: deviceInfo || undefined,
    }),
  })
}

export function checkOutAttendance({
  employeeId,
  latitude,
  longitude,
  accuracy,
  doorToken,
  qrLocationId,
  verificationToken,
  deviceInfo,
}) {
  return request('/api/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      latitude,
      longitude,
      accuracy,
      door_token: doorToken || undefined,
      qr_location_id: qrLocationId || undefined,
      verification_token: verificationToken || undefined,
      device_info: deviceInfo || undefined,
    }),
  })
}

export function getAdminAttendanceCredentials() {
  return request('/api/admin/attendance-credentials')
}

export function adminGenerateAttendanceCode(employeeId) {
  return request('/api/admin/attendance-credentials/generate', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  })
}

export function adminAssignAttendanceCode({ employeeId, verificationCode }) {
  return request('/api/admin/attendance-credentials/assign', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId, verification_code: verificationCode }),
  })
}

export function adminToggleAttendanceCredential({ employeeId, active }) {
  return request('/api/admin/attendance-credentials/toggle', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId, active }),
  })
}

export function adminUnlockAttendanceCredential(employeeId) {
  return request('/api/admin/attendance-credentials/unlock', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  })
}

export function adminRevokeAttendanceCredential(employeeId) {
  return request('/api/admin/attendance-credentials/revoke', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId }),
  })
}

export function adminSeedAttendanceCredentials() {
  return request('/api/admin/attendance-credentials/seed', {
    method: 'POST',
  })
}

export function getAttendanceConfiguration() {
  return request('/api/attendance/configuration')
}

export function saveAttendanceConfiguration(settings) {
  return request('/api/attendance/configuration', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function getAttendanceExportUrl({ date = '', search = '', type = 'All', status = 'All' } = {}) {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (search.trim()) params.set('search', search.trim())
  if (type && type !== 'All') params.set('type', type)
  if (status && status !== 'All') params.set('status', status)
  const q = params.toString()
  return `${API}/api/attendance/export${q ? `?${q}` : ''}`
}

export function deleteEntitlement(module, id) {
  return request(`/api/entitlements/${module}/${id}`, { method: 'DELETE' })
}

export function getLeaveRequests() {
  return request('/api/entitlements/leave')
}

export function applyLeaveRequest(data) {
  return request('/api/entitlements/leave', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateLeaveStatus(leaveId, status, remarks = '') {
  return request(`/api/entitlements/leave/${encodeURIComponent(leaveId)}`, {
    method: 'PUT',
    body: JSON.stringify({ status, remarks }),
  })
}

export function cancelLeaveRequest(leaveId, reason = '') {
  return request(`/api/entitlements/leave/${encodeURIComponent(leaveId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function getAttendanceRange(startDate, endDate, officeId = '') {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  if (officeId && officeId !== 'ALL') params.set('office_id', officeId)
  return request(`/api/attendance/range?${params.toString()}`)
}

export function getAttendanceCalendar(year, month, officeId = '') {
  const params = new URLSearchParams({ year, month })
  if (officeId && officeId !== 'ALL') params.set('office_id', officeId)
  return request(`/api/attendance/calendar?${params.toString()}`)
}

export function deleteLeaveRequest(leaveId) {
  return request(`/api/entitlements/leave/${encodeURIComponent(leaveId)}`, {
    method: 'DELETE',
  })
}

export function getEntitlementsSummary() {
  return request('/api/entitlements/summary')
}

export function getEntitlementRecords({ employeeId = '', category = '', status = '', search = '' } = {}) {
  const params = new URLSearchParams()
  if (employeeId) params.set('employee_id', employeeId)
  if (category && category !== 'all') params.set('category', category)
  if (status && status !== 'all') params.set('status', status)
  if (search) params.set('search', search)
  const q = params.toString()
  return request(`/api/entitlements/records${q ? `?${q}` : ''}`)
}

export function getEmployeeEntitlements(employeeId) {
  return request(`/api/entitlements/employee/${encodeURIComponent(employeeId)}`)
}

export function createEntitlementRecord(data) {
  return request('/api/entitlements/records', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateEntitlementRecord(recordId, data) {
  return request(`/api/entitlements/records/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function actionEntitlementRecord(recordId, { action, notes = '' }) {
  return request(`/api/entitlements/records/${encodeURIComponent(recordId)}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, notes }),
  })
}

export function updateEmployeeServiceProfile(employeeId, data) {
  return request(`/api/entitlements/employee/${encodeURIComponent(employeeId)}/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function getEntitlementsReports() {
  return request('/api/entitlements/reports/data')
}

export function getEntitlementAudit(recordId) {
  return request(`/api/entitlements/audit/${encodeURIComponent(recordId)}`)
}

export function getPayroll(month) {
  return request(`/api/payroll?month=${encodeURIComponent(month)}`)
}

export function getProductivity(employeeId, week, year) {
  const params = new URLSearchParams()
  if (week) params.set('week', week)
  if (year) params.set('year', year)
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

export function getCoach(employeeId, week, year) {
  const params = new URLSearchParams()
  if (week) params.set('week', week)
  if (year) params.set('year', year)
  const query = params.toString()
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/coach${query ? `?${query}` : ''}`)
}


export function chatCoach(employeeId, message, week, year, language = 'en') {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/coach/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, week, year, language }),
  })
}

export function askCoach(employeeId, week, question, year) {
  return request(`/api/productivity/${encodeURIComponent(employeeId)}/coach/ask`, {
    method: 'POST',
    body: JSON.stringify({ week, question, year }),
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

export function simulateKpi(payload) {
  return request('/api/kpi/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getKpiSimulations(limit = 20) {
  return request(`/api/kpi/simulations?limit=${limit}`)
}

export function getEmployeeKpiHistory(employeeId) {
  return request(`/api/employees/${encodeURIComponent(employeeId)}/kpi-history`)
}

export function getPayrollDashboardMetrics(period = 'January – August 2026') {
  return request(`/api/payroll/dashboard-metrics?period=${encodeURIComponent(period)}`)
}

export function getEmployeePayrollSummary(employeeId, period = 'January – August 2026') {
  return request(`/api/payroll/employee/${encodeURIComponent(employeeId)}/summary?period=${encodeURIComponent(period)}`)
}

export function createOtRecord(payload) {
  return request('/api/payroll/ot-record', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getCalculationRules() {
  return request('/api/payroll/calculation-rules')
}

// ── DAILY ACCOUNTS API METHODS ─────────────────────────────────────────────

export function getDailyAccountsOffices() {
  return request('/api/daily-accounts/offices')
}

export function getDailyAccountsSummary(
  officeId = 'PO-COLOMBO-CENTRAL',
  startDate = '2026-07-01',
  endDate = '2026-09-01',
  dataMode = 'auto'
) {
  return request(`/api/daily-accounts/summary?office_id=${encodeURIComponent(officeId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&data_mode=${encodeURIComponent(dataMode)}`)
}

export function getDailyAccountsTrends(
  mode = 'Week',
  weekSelector = 'Week 3 (14 Jul - 20 Jul 2026)',
  dataMode = 'auto'
) {
  return request(`/api/daily-accounts/trends?mode=${encodeURIComponent(mode)}&week_selector=${encodeURIComponent(weekSelector)}&data_mode=${encodeURIComponent(dataMode)}`)
}

export function getDailyMoneyOrdersChart(
  weekSelector = 'Week 3 (14 Jul - 20 Jul 2026)',
  dataMode = 'auto'
) {
  return request(`/api/daily-accounts/money-orders-chart?week_selector=${encodeURIComponent(weekSelector)}&data_mode=${encodeURIComponent(dataMode)}`)
}

export function getDailyAccountsRevenueBreakdown(dataMode = 'auto') {
  return request(`/api/daily-accounts/revenue-breakdown?data_mode=${encodeURIComponent(dataMode)}`)
}

export function getDailyAccountsCashReconciliation(
  officeId = 'PO-COLOMBO-CENTRAL',
  date = '2026-09-01',
  dataMode = 'auto'
) {
  return request(`/api/daily-accounts/cash-reconciliation?office_id=${encodeURIComponent(officeId)}&date=${encodeURIComponent(date)}&data_mode=${encodeURIComponent(dataMode)}`)
}

export function getDailyAccountsRecentSheets(
  officeId = 'PO-COLOMBO-CENTRAL',
  dataMode = 'auto'
) {
  return request(`/api/daily-accounts/recent-sheets?office_id=${encodeURIComponent(officeId)}&data_mode=${encodeURIComponent(dataMode)}`)
}

export async function inspectDailyAccountsFile(formData) {
  const token = await ensureCsrfToken()
  const headers = {}
  if (token) {
    headers['X-CSRF-Token'] = token
  }
  let res
  try {
    res = await fetch(`${API}/api/daily-accounts/inspect-file`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    })
  } catch (networkError) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Network connection is offline. Please check your connectivity.')
    }
    const targetUrl = API || (typeof window !== 'undefined' ? `${window.location.origin}/api/daily-accounts/inspect-file` : '/api/daily-accounts/inspect-file')
    throw new Error(`Unable to connect to the Post-Assist API server at ${targetUrl}. Please ensure the FastAPI backend is running and listening on port 8000.`)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    throw new Error(data?.detail || `File inspection failed (${res.status})`)
  }
  return data
}

export async function uploadDailyAccountsFile(formData) {
  const token = await ensureCsrfToken()
  const headers = {}
  if (token) {
    headers['X-CSRF-Token'] = token
  }
  let res
  try {
    res = await fetch(`${API}/api/daily-accounts/upload/preview`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    })
  } catch (networkError) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Network connection is offline. Please check your connectivity.')
    }
    const targetDesc = API ? `${API}/api/daily-accounts/upload/preview` : 'FastAPI backend (http://127.0.0.1:8000/api/daily-accounts/upload/preview via proxy)'
    throw new Error(`Unable to connect to the Post-Assist API server at ${targetDesc}. Please ensure the FastAPI backend is running and listening on port 8000.`)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    throw new Error(data?.detail || `File upload failed (${res.status})`)
  }
  return data
}

export const previewDailyAccountsUpload = uploadDailyAccountsFile

export async function confirmDailyAccountsImport(payload) {
  await ensureCsrfToken()
  const batchId = payload.batch_id || payload.batch_meta?.batch_id
  const bodyPayload = {
    batch_id: batchId,
    batch_meta: payload.batch_meta,
    import_mode: payload.import_mode || 'append',
    dataset_category: payload.dataset_category,
    // Only send full records as fallback if batchId is somehow absent
    ...(batchId ? {} : { records: payload.records, issues: payload.issues }),
  }
  return request('/api/daily-accounts/upload/confirm', {
    method: 'POST',
    body: JSON.stringify(bodyPayload),
  })
}

export const confirmDailyAccountsUpload = confirmDailyAccountsImport

export function getDailyAccountsImports(officeId = '') {
  const params = new URLSearchParams()
  if (officeId) params.set('office_id', officeId)
  return request(`/api/daily-accounts/imports?${params.toString()}`)
}

export function getDailyAccountsValidationReport(importId) {
  return request(`/api/daily-accounts/imports/${encodeURIComponent(importId)}/validation-report`)
}

export function deleteDailyAccountsBatch(batchId) {
  return request(`/api/daily-accounts/batches/${encodeURIComponent(batchId)}`, {
    method: 'DELETE',
  })
}

export function getDailyAccountsCategoryRecords(
  category = '',
  officeId = 'PO-COLOMBO-CENTRAL',
  startDate = '',
  endDate = '',
  dataMode = 'auto'
) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (officeId) params.set('office_id', officeId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (dataMode) params.set('data_mode', dataMode)
  return request(`/api/daily-accounts/category-records?${params.toString()}`)
}

export function getDailyAccountsValidationIssues(severity = '', status = '', dataMode = 'auto') {
  const params = new URLSearchParams()
  if (severity) params.set('severity', severity)
  if (status) params.set('status', status)
  if (dataMode) params.set('data_mode', dataMode)
  return request(`/api/daily-accounts/validation-issues?${params.toString()}`)
}

export function resolveDailyAccountsIssue(issueId, correction = '') {
  return request(`/api/daily-accounts/validation-issues/${encodeURIComponent(issueId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ correction }),
  })
}

export function getDailyAccountsGlPredictions(dataMode = 'auto') {
  return request(`/api/daily-accounts/gl-predictions?data_mode=${encodeURIComponent(dataMode)}`)
}

export function approveDailyAccountsGlPrediction(recordId, approvedGlCode) {
  return request(`/api/daily-accounts/gl-predictions/${encodeURIComponent(recordId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved_gl_code: approvedGlCode }),
  })
}

export function getDailyAccountsAuditHistory() {
  return request('/api/daily-accounts/audit-history')
}

export function resetDailyAccountsDemo() {
  return request('/api/daily-accounts/reset-demo', {
    method: 'POST',
  })
}

export function createDailyAccountTransaction(data) {
  return request('/api/daily-accounts/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getDailyAccountTransactions(params = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      q.append(k, v)
    }
  }
  return request(`/api/daily-accounts/transactions?${q.toString()}`)
}

export function getDailyAccountTransactionById(txId) {
  return request(`/api/daily-accounts/transactions/${encodeURIComponent(txId)}`)
}

export function updateDailyAccountTransaction(txId, updates) {
  return request(`/api/daily-accounts/transactions/${encodeURIComponent(txId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function updateDailyAccountTransactionStatus(txId, status, remarks = '') {
  return request(`/api/daily-accounts/transactions/${encodeURIComponent(txId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, remarks }),
  })
}

export async function downloadDailyAccountCategoryExcel(category, officeId = 'PO-COLOMBO-CENTRAL', date = '', clerkId = '', status = '') {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  if (officeId) params.append('office_id', officeId)
  if (date) params.append('date', date)
  if (clerkId) params.append('clerk_id', clerkId)
  if (status) params.append('status', status)

  const res = await fetch(`${API}/api/daily-accounts/export/category?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Excel export failed' }))
    throw new Error(err.detail || 'Excel export failed')
  }
  const blob = await res.blob()
  const safeCat = (category || 'Transactions').replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `SLP_${safeCat}_${officeId}_${date || 'Period'}.xlsx`
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadConsolidatedDailyExcel(officeId = 'PO-COLOMBO-CENTRAL', date = '') {
  const params = new URLSearchParams()
  if (officeId) params.append('office_id', officeId)
  if (date) params.append('date', date)

  const res = await fetch(`${API}/api/daily-accounts/export/consolidated?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Consolidated report download failed' }))
    throw new Error(err.detail || 'Consolidated report download failed')
  }
  const blob = await res.blob()
  const filename = `SLP_Consolidated_Daily_Accounts_${officeId}_${date || 'Period'}.xlsx`
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export function getDailyAccountsReports(params = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      q.append(k, v)
    }
  }
  return request(`/api/daily-accounts/reports?${q.toString()}`)
}

export async function downloadDailyAccountsReportExcel(filters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') {
      params.append(k, v)
    }
  }
  const res = await fetch(`${API}/api/daily-accounts/reports/export?${params.toString()}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Report Excel export failed' }))
    throw new Error(err.detail || 'Report Excel export failed')
  }
  const blob = await res.blob()
  const filename = `SLP_Accounting_Report_${filters.office_id || 'Colombo'}_${filters.start_date || 'Start'}_to_${filters.end_date || 'End'}.xlsx`
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}



