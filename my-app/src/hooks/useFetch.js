import { useState, useEffect, useCallback, useRef } from 'react'

// Runs an async API function, exposing { data, meta, loading, error, refetch, setData }.
// Automatically:
// 1. Instantly refetches when ANY CRUD mutation (POST/PUT/PATCH/DELETE) succeeds anywhere in the CRM.
// 2. Refetches on window/tab focus or visibility.
// 3. Silently auto-refreshes in the background every 5 seconds for live data sync.
// 4. Handles rapid search & clear requests with sequence IDs (never drops in-flight calls or shows stale results).
export function useFetch(fn, depsOrOptions, maybeOptions) {
  let deps = null
  let options = {}

  if (Array.isArray(depsOrOptions)) {
    deps = depsOrOptions
    if (maybeOptions && typeof maybeOptions === 'object') {
      options = maybeOptions
    }
  } else if (depsOrOptions && typeof depsOrOptions === 'object') {
    options = depsOrOptions
  }

  const {
    autoRefresh = true,
    refreshInterval = 5000, // 5 seconds interval for live real-time synchronization
    revalidateOnFocus = true,
  } = options

  const [data, setData] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  const reqId = useRef(0)

  // silent = true keeps loading state false to prevent UI flicker/spinners during background refresh
  const run = useCallback(async (silent = false) => {
    const thisReqId = ++reqId.current

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const res = await fn()
      // If a newer request was initiated while this one was running (e.g. rapid typing in search or clearing),
      // discard this older response so stale data NEVER overwrites newer fresh data!
      if (!mounted.current || thisReqId !== reqId.current) return

      setData(res.data?.data !== undefined ? res.data.data : res.data)
      setMeta(res.data?.meta || null)
      if (silent) setError(null)
    } catch (err) {
      if (!mounted.current || thisReqId !== reqId.current) return
      // During silent background auto-refresh, avoid wiping out existing data with an error banner
      if (!silent) {
        setError(err.response?.data?.message || 'Failed to load')
      }
    } finally {
      if (mounted.current && thisReqId === reqId.current && !silent) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || [fn])

  // Initial load
  useEffect(() => {
    mounted.current = true
    run(false)
    return () => {
      mounted.current = false
    }
  }, [run])

  // Instant Auto-Refresh on ANY CRUD operation (create, update, delete, transfer, etc.) anywhere in the CRM
  useEffect(() => {
    let timer = null
    const handleMutation = () => {
      if (!mounted.current || document.visibilityState !== 'visible') return
      // Small debounce (50ms) to batch multiple rapid changes (e.g. bulk actions)
      clearTimeout(timer)
      timer = setTimeout(() => {
        run(true) // Silent instant refresh
      }, 50)
    }

    window.addEventListener('crm:data-mutation', handleMutation)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('crm:data-mutation', handleMutation)
    }
  }, [run])

  // Background Auto-Refresh interval (every 5 seconds when tab is active)
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        run(true)
      }
    }, refreshInterval)

    return () => {
      clearInterval(timer)
    }
  }, [run, autoRefresh, refreshInterval])

  // Tab / window focus revalidation
  useEffect(() => {
    if (!revalidateOnFocus) return

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        run(true)
      }
    }

    window.addEventListener('focus', handleFocusOrVisible)
    document.addEventListener('visibilitychange', handleFocusOrVisible)

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible)
      document.removeEventListener('visibilitychange', handleFocusOrVisible)
    }
  }, [run, revalidateOnFocus])

  const refetch = useCallback(() => run(false), [run])

  return { data, meta, loading, error, refetch, setData }
}
