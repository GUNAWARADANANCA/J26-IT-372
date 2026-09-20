/**
 * localStorage-backed repository.
 * Swap list/get/create/update/remove bodies for fetch('/api/...') when Postgres is ready.
 */

const PREFIX = 'postal_kpi'

function storageKey(doctype) {
  return `${PREFIX}:${doctype}`
}

function readAll(doctype) {
  try {
    const raw = localStorage.getItem(storageKey(doctype))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(doctype, rows) {
  localStorage.setItem(storageKey(doctype), JSON.stringify(rows))
}

export function isHydrated(doctype) {
  return localStorage.getItem(`${PREFIX}:hydrated:${doctype}`) === '1'
}

export function markHydrated(doctype) {
  localStorage.setItem(`${PREFIX}:hydrated:${doctype}`, '1')
}

export function clearHydrated(doctype) {
  localStorage.removeItem(`${PREFIX}:hydrated:${doctype}`)
  localStorage.removeItem(storageKey(doctype))
}

export function list(doctype, { search = '', filters = {} } = {}) {
  let rows = readAll(doctype)
  const q = search.trim().toLowerCase()
  if (q) {
    rows = rows.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(q),
      ),
    )
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    rows = rows.filter((row) => String(row[key] ?? '') === String(value))
  }
  return rows
}

export function get(doctype, name) {
  return readAll(doctype).find((r) => r.name === name) ?? null
}

export function create(doctype, doc) {
  const rows = readAll(doctype)
  if (!doc.name) {
    throw new Error('Document name is required')
  }
  if (rows.some((r) => r.name === doc.name)) {
    throw new Error(`Document ${doc.name} already exists`)
  }
  const next = { ...doc }
  rows.push(next)
  writeAll(doctype, rows)
  return next
}

export function update(doctype, name, doc) {
  const rows = readAll(doctype)
  const idx = rows.findIndex((r) => r.name === name)
  if (idx < 0) throw new Error(`Document ${name} not found`)
  const next = { ...doc, name: doc.name || name }
  // If renaming, ensure uniqueness
  if (next.name !== name && rows.some((r) => r.name === next.name)) {
    throw new Error(`Document ${next.name} already exists`)
  }
  rows[idx] = next
  writeAll(doctype, rows)
  return next
}

export function remove(doctype, name) {
  const rows = readAll(doctype)
  const next = rows.filter((r) => r.name !== name)
  if (next.length === rows.length) throw new Error(`Document ${name} not found`)
  writeAll(doctype, next)
  return true
}

export function replaceAll(doctype, rows) {
  writeAll(doctype, rows)
  markHydrated(doctype)
}

export function count(doctype) {
  return readAll(doctype).length
}
