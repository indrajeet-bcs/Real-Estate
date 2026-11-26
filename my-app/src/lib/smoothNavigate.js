import { useNavigate } from 'react-router-dom'

let pendingCommitTarget = null
let resolvePendingCommit = null
let pendingTimerId = null

function clearPendingCommit() {
  if (pendingTimerId !== null) {
    clearTimeout(pendingTimerId)
    pendingTimerId = null
  }
  pendingCommitTarget = null
  resolvePendingCommit = null
}

/**
 * Call inside useLayoutEffect on destination routes so document.startViewTransition
 * waits until React's BrowserRouter transition actually commits the new page DOM.
 */
export function notifyRouteCommitted(routePath) {
  if (resolvePendingCommit && (!pendingCommitTarget || pendingCommitTarget === routePath)) {
    const resolve = resolvePendingCommit
    clearPendingCommit()
    resolve()
  }
}

/**
 * Returns a click handler that runs a smooth same-document View Transition
 * (or progressive fallback) between Landing (/) and Login (/login).
 */
export function useSmoothRouteNavigate({
  to,
  transitionType,
  focusTargetId,
}) {
  const navigate = useNavigate()

  return function handleSmoothClick(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return
    }
    e.preventDefault()

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (typeof document === 'undefined' || !document.startViewTransition || reduceMotion) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      navigate(to, { state: { smoothNav: !reduceMotion, transitionType } })
      return
    }

    const rootEl = document.documentElement
    rootEl.setAttribute('data-view-transition', transitionType)

    clearPendingCommit()
    const transition = document.startViewTransition(() => {
      return new Promise((resolve) => {
        pendingCommitTarget = to
        resolvePendingCommit = resolve
        // Fallback timeout guarantees transition never stalls if route redirects away
        pendingTimerId = window.setTimeout(() => {
          const fn = resolvePendingCommit
          clearPendingCommit()
          fn?.()
        }, 200)

        window.scrollTo({ top: 0, behavior: 'instant' })
        navigate(to)
      })
    })

    transition.finished.finally(() => {
      clearPendingCommit()
      rootEl.removeAttribute('data-view-transition')
      if (focusTargetId) {
        document.getElementById(focusTargetId)?.focus({ preventScroll: true })
      }
    })
  }
}
