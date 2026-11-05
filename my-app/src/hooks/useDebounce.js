import { useState, useEffect } from 'react'

// Debounces a rapidly-changing value (e.g. a search box) by `delay` ms.
// When cleared (empty string or null), updates IMMEDIATELY with 0ms delay.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    // If empty or cleared, update immediately!
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      setDebounced(value)
      return
    }

    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
