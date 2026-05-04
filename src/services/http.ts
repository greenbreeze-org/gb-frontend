// Base API URL from environment, falling back to relative /api/v1.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api/v1'

// Build URL with query parameters.
export const buildUrl = (path: string, query?: Record<string, string>) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${API_BASE_URL}${normalizedPath}`, window.location.origin)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

export const apiGet = async <T>(path: string, query?: Record<string, string>): Promise<T> => {
  const response = await fetch(buildUrl(path, query))

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`POST ${path} failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}
