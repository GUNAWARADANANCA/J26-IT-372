const API = import.meta.env.VITE_API_URL ?? ''

/** Confirm the API is up. Records live in MongoDB. */
export async function ensureSeeded() {
  let response
  try {
    response = await fetch(`${API}/health`)
  } catch {
    throw new Error(
      'Cannot reach the API. Start the backend with: cd backend && .\\.venv\\Scripts\\python.exe main.py',
    )
  }
  if (!response.ok) {
    throw new Error(`API health check failed (${response.status})`)
  }
}
