import { useState, useEffect, useCallback, useRef } from 'react'

// Runs an async API function, exposing { data, meta, loading, error, refetch }.
// `deps` re-runs the call; pass a stable fn via useCallback from the caller.
export function useFetch(fn, deps) {
  const [data, setData] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fn()
      if (!mounted.current) return
      setData(res.data.data)
      setMeta(res.data.meta || null)
    } catch (err) {
      if (!mounted.current) return
      setError(err.response?.data?.message || 'Failed to load')
    } finally {
      if (mounted.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps || [fn])

  useEffect(() => {
    mounted.current = true
    run()
    return () => {
      mounted.current = false
    }
  }, [run])

  return { data, meta, loading, error, refetch: run, setData }
}
