const API = import.meta.env.VITE_API_URL ?? ''

/** Confirm the API is up. Records live in MongoDB. */
export async function ensureSeeded() {
  let lastError = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    try {
      const response = await fetch(`${API}/health`)
      if (response.ok) return
      lastError = new Error(`API health check failed (${response.status})`)
    } catch {
      lastError = new Error(
        'Cannot reach the API. Start the backend with: cd backend && .\\.venv\\Scripts\\python.exe main.py',
      )
    }
  }
  throw lastError
}
