import { useState, useEffect } from 'react'

// Debounces a rapidly-changing value (e.g. a search box) by `delay` ms.
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
