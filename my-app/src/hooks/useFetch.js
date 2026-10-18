import { useState, useEffect, useCallback, useRef } from 'react'

// Runs an async API function, exposing { data, meta, loading, error, refetch }.
// Automatically refreshes every 8 seconds (5-10s interval) silently in the background
// and revalidates when the tab/window regains focus.
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
    refreshInterval = 8000, // 8 seconds (configurable 5-10s)
    revalidateOnFocus = true,
  } = options

  const [data, setData] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  const inFlight = useRef(false)

  // silent = true keeps loading state false to prevent UI flicker/spinners during background refresh
  const run = useCallback(async (silent = false) => {
    if (inFlight.current) return
    inFlight.current = true

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const res = await fn()
      if (!mounted.current) return
      setData(res.data.data)
      setMeta(res.data.meta || null)
      if (silent) setError(null)
    } catch (err) {
      if (!mounted.current) return
      // During silent background auto-refresh, avoid overwriting existing data with an error state
      if (!silent) {
        setError(err.response?.data?.message || 'Failed to load')
      }
    } finally {
      inFlight.current = false
      if (mounted.current && !silent) {
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

  // Auto-refresh interval (every 8 seconds when browser tab is active)
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

