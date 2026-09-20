import {
  clearHydrated,
  isHydrated,
  markHydrated,
  replaceAll,
} from './repository'

export const DOCTYPES = {
  employee: 'employee',
  daily_kpi_log: 'daily_kpi_log',
  attendance_log: 'attendance_log',
}

const SEED_URLS = {
  [DOCTYPES.employee]: '/data/employees.json',
  [DOCTYPES.daily_kpi_log]: '/data/daily_kpi_logs.json',
  [DOCTYPES.attendance_log]: '/data/attendance_logs.json',
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load seed ${url}: ${res.status}`)
  return res.json()
}

/** Hydrate empty localStorage from public seed JSON (once per doctype). */
export async function ensureSeeded() {
  const tasks = []
  for (const [doctype, url] of Object.entries(SEED_URLS)) {
    if (isHydrated(doctype)) continue
    tasks.push(
      fetchJson(url).then((rows) => {
        replaceAll(doctype, rows)
        markHydrated(doctype)
      }),
    )
  }
  await Promise.all(tasks)
}

/** Wipe and reload Excel seed data. */
export async function resetToSeed() {
  for (const doctype of Object.keys(SEED_URLS)) {
    clearHydrated(doctype)
  }
  await ensureSeeded()
}
