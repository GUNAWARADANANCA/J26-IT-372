const API = import.meta.env.VITE_API_URL ?? ''

/** Confirm the API is up. Records live in MongoDB. */
export async function ensureSeeded() {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
    try {
      const response = await fetch(`${API}/health`, { cache: 'no-store' })
      if (response.ok) return
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        continue
      }
    } catch {
      // Backend warming up
    }
  }
  // Allow UI to mount gracefully rather than trapping the user on boot screen
}
