import { useEffect } from 'react'

let lockCount = 0
let originalOverflow = ''
let originalPaddingRight = ''

/**
 * Locks document.body scrolling while preserving scrollbar width to prevent horizontal layout shift.
 * Handles nested/concurrent modals via reference counting.
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined') return () => {}

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow || ''
    originalPaddingRight = document.body.style.paddingRight || ''

    // Calculate vertical scrollbar width before locking
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'
  }
  lockCount++

  let unlocked = false
  return () => {
    if (unlocked) return
    unlocked = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }
}

/**
 * React hook to lock document body scrolling when a modal or popup is open.
 * Automatically cleans up on unmount or when `isLocked` becomes false.
 */
export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return
    const unlock = lockBodyScroll()
    return () => {
      unlock()
    }
  }, [isLocked])
}

