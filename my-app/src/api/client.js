import axios from 'axios'

// Central axios instance. Access token is held in memory (set by AuthContext)
// and attached per-request; the refresh token lives in an httpOnly cookie.
const rawUrl = import.meta.env.VITE_API_URL || '/api'
const baseURL = (rawUrl.startsWith('http') && !rawUrl.endsWith('/api') && !rawUrl.endsWith('/api/'))
  ? `${rawUrl.replace(/\\+$/, '')}/api`
  : rawUrl

const api = axios.create({
  baseURL,
  withCredentials: true, // send the refresh cookie
})

let accessToken = null
let onUnauthorized = null // callback to force logout when refresh fails
let onSessionUpdated = null // callback to sync user state if refreshed transparently

export function setAccessToken(token) {
  accessToken = token
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export function setSessionUpdatedHandler(fn) {
  onSessionUpdated = fn
}

// Global CRUD mutation notification bus
export function notifyDataMutation(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm:data-mutation', { detail }))
  }
}

export function triggerGlobalRefresh() {
  notifyDataMutation({ manual: true, timestamp: Date.now() })
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// On successful response: if method was POST, PUT, PATCH, or DELETE,
// broadcast an instant mutation event so all active views refresh automatically.
let refreshing = null

api.interceptors.response.use(
  (res) => {
    const method = res.config?.method?.toLowerCase()
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const url = res.config?.url || ''
      // Ignore auth session endpoints
      if (!url.includes('/auth/login') && !url.includes('/auth/refresh') && !url.includes('/auth/me')) {
        notifyDataMutation({ method, url, timestamp: Date.now() })
      }
    }
    return res
  },
  async (error) => {
    const original = error.config
    const status = error.response?.status

    const isAuthEndpoint =
      original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh')

    if (status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        refreshing = refreshing || api.post('/auth/refresh')
        const { data } = await refreshing
        refreshing = null
        const newToken = data?.data?.accessToken
        const newUser = data?.data?.user
        if (newToken) {
          setAccessToken(newToken)
          onSessionUpdated?.(newUser)
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        }
      } catch {
        refreshing = null
        onUnauthorized?.()
      }
    }
    return Promise.reject(error)
  }
)

export default api
