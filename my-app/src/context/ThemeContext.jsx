import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('app_theme') || 'Light'
    } catch {
      return 'Light'
    }
  })

  const applyTheme = useCallback((currentTheme) => {
    const root = document.documentElement
    let isDark = false

    if (currentTheme === 'Dark') {
      isDark = true
    } else if (currentTheme === 'System Default') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      isDark = false
    }

    if (isDark) {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
      root.style.colorScheme = 'light'
    }
  }, [])

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('app_theme', newTheme)
    } catch {
      // ignore
    }
    applyTheme(newTheme)
  }, [applyTheme])

  useEffect(() => {
    applyTheme(theme)

    if (theme === 'System Default') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = () => applyTheme('System Default')
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }
  }, [theme, applyTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

