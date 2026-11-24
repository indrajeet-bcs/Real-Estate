import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { setAccessToken, setUnauthorizedHandler, setSessionUpdatedHandler } from '../api/client.js'
import { authApi } from '../api/auth.api.js'
import { toast } from 'react-toastify'

// 30-minute idle timeout — industry standard for CRM/B2B apps.
// Matches SESSION_IDLE_TIMEOUT_MIN=30 in server/.env
const IDLE_TIMEOUT_MS = 30 * 60 * 1000        // 30 minutes
const IDLE_WARN_MS = IDLE_TIMEOUT_MS - 2 * 60 * 1000 // warn at 28 minutes

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const warnToastId = useRef(null)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setPermissions({})
  }, [])

  // On refresh failure anywhere, drop the session and redirect to landing page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      navigate('/', { replace: true })
    })
    setSessionUpdatedHandler((newUser) => {
      if (newUser) {
        setUser(newUser)
        // Note: permissions aren't currently returned by interceptor refresh in client.js,
        // but if they were, we would update them here. To be safe, if the user role changed,
        // the protected route will redirect anyway.
      }
    })
  }, [clearSession, navigate])

  // On mount, try to restore a session via the refresh cookie.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await authApi.refresh()
        if (!active) return
        setAccessToken(data.data.accessToken)
        setUser(data.data.user)
        setPermissions(data.data.permissions || {})
      } catch {
        clearSession()
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [clearSession])

  // ── 30-minute idle session timeout ───────────────────────────────────────
  // Activity events reset both timers. At 28 min we show a warning toast;
  // at 30 min we force logout. This matches SESSION_IDLE_TIMEOUT_MIN=30 in
  // server/.env and the backend's lastActivity cookie enforcement.
  useEffect(() => {
    if (!user) return

    let logoutTimer
    let warnTimer

    const doLogout = async () => {
      try { await authApi.logout() } catch { /* ignore */ }
      clearSession()
      navigate('/', { replace: true })
      toast.error('You were logged out due to inactivity.', { autoClose: 6000 })
    }

    const resetTimers = () => {
      clearTimeout(logoutTimer)
      clearTimeout(warnTimer)
      // Dismiss any pending warning toast
      if (warnToastId.current) {
        toast.dismiss(warnToastId.current)
        warnToastId.current = null
      }
      warnTimer = setTimeout(() => {
        warnToastId.current = toast.warning('⚠️ You will be logged out in 2 minutes due to inactivity.', {
          autoClose: 120000,
          toastId: 'idle-warning-toast',
        })
      }, IDLE_WARN_MS)
      logoutTimer = setTimeout(doLogout, IDLE_TIMEOUT_MS)
    }

    const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    EVENTS.forEach((e) => window.addEventListener(e, resetTimers, { passive: true }))
    resetTimers() // start timers immediately when user logs in

    return () => {
      clearTimeout(logoutTimer)
      clearTimeout(warnTimer)
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimers))
    }
  }, [user, clearSession, navigate])
  // ─────────────────────────────────────────────────────────────────────────

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password)
    setAccessToken(data.data.accessToken)
    setUser(data.data.user)
    setPermissions(data.data.permissions || {})
    return data.data.user
  }, [])

  // Merge fresh fields into the signed-in user so header/profile reflect edits
  // immediately (spec §Profile Business Rules).
  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* ignore network errors on logout */
    }
    navigate('/', { replace: true })
    clearSession()
  }, [clearSession, navigate])

  // Permission check mirroring the backend matrix (§14).
  const can = useCallback(
    (module, action) => {
      const allowed = permissions[module]
      if (!allowed) return false
      return allowed.includes('*') || allowed.includes(action)
    },
    [permissions]
  )

  const value = {
    user,
    permissions,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    updateUser,
    can,
    api,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
