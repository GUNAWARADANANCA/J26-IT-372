// Durable local queue of scan events (proposal 3.11, FR13, test T11).
//
// An event is written here *before* any upload is attempted, with an event_id
// generated once. Uploads always reuse that id, so a retry after a timeout or
// an app restart can never create a second event on the server. An event is
// marked done only after the server returns a durable answer (accepted,
// duplicate, held or rejected); network failures leave it pending.
import * as SQLite from 'expo-sqlite'

let dbPromise

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('postassist_field.db')
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS scan_queue (
          event_id TEXT PRIMARY KEY NOT NULL,
          item_id TEXT NOT NULL,
          requested_status TEXT NOT NULL,
          payload TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'pending',
          decision TEXT,
          message TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS scan_queue_state ON scan_queue(state, captured_at);
      `)
      return db
    })()
  }
  return dbPromise
}

export async function enqueue(event) {
  const db = await getDb()
  await db.runAsync(
    'INSERT INTO scan_queue (event_id, item_id, requested_status, payload, captured_at) VALUES (?, ?, ?, ?, ?)',
    event.event_id, event.item_id, event.requested_status, JSON.stringify(event), event.captured_at,
  )
}

export async function pendingEvents(limit = 50) {
  const db = await getDb()
  const rows = await db.getAllAsync("SELECT * FROM scan_queue WHERE state = 'pending' ORDER BY captured_at LIMIT ?", limit)
  return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) }))
}

export async function markResult(eventId, { state, decision, message }) {
  const db = await getDb()
  await db.runAsync(
    'UPDATE scan_queue SET state = ?, decision = ?, message = ?, synced_at = ?, attempts = attempts + 1, last_error = NULL WHERE event_id = ?',
    state, decision || null, message || null, new Date().toISOString(), eventId,
  )
}

export async function markAttemptFailed(eventIds, error) {
  const db = await getDb()
  for (const id of eventIds) {
    await db.runAsync('UPDATE scan_queue SET attempts = attempts + 1, last_error = ? WHERE event_id = ?', String(error).slice(0, 200), id)
  }
}

export async function recentEvents(limit = 30) {
  const db = await getDb()
  return db.getAllAsync('SELECT event_id, item_id, requested_status, captured_at, state, decision, message, attempts, last_error FROM scan_queue ORDER BY captured_at DESC LIMIT ?', limit)
}

export async function counts() {
  const db = await getDb()
  const rows = await db.getAllAsync('SELECT state, COUNT(*) AS n FROM scan_queue GROUP BY state')
  return Object.fromEntries(rows.map((r) => [r.state, r.n]))
}

export async function pruneOld(days = 14) {
  const db = await getDb()
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  await db.runAsync("DELETE FROM scan_queue WHERE state != 'pending' AND captured_at < ?", cutoff)
}
