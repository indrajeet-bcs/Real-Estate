import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { NAV_BY_ROLE } from '../../lib/navConfig.js'
import { ROLE_LABELS, ROLES } from '../../lib/constants.js'
import { actionCenterApi, branchSettingsApi } from '../../api/resources.js'
import NotificationBell from './NotificationBell.jsx'

// Shared shell for all authenticated role dashboards: sidebar nav (role-gated)
// + top bar with the current user and logout.
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const nav = NAV_BY_ROLE[user.role] || []

  const [expandedDropdown, setExpandedDropdown] = useState(null)
  const [actionCount, setActionCount] = useState(0)
  const [geofenceRadius, setGeofenceRadius] = useState(200)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Mobile drawer open state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  // Desktop sidebar collapse/expand state (persisted in localStorage)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_sidebar_desktop_open')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  // Close the mobile sidebar drawer whenever the route changes.
  useEffect(() => { setMobileSidebarOpen(false) }, [location.pathname])

  // Persist desktop sidebar state
  useEffect(() => {
    try {
      localStorage.setItem('crm_sidebar_desktop_open', String(desktopSidebarOpen))
    } catch {}
  }, [desktopSidebarOpen])

  const toggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setDesktopSidebarOpen((prev) => !prev)
    } else {
      setMobileSidebarOpen((prev) => !prev)
    }
  }, [])

  // Real geofence radius for the Sub-Admin's branch (footer card).
  useEffect(() => {
    if (user.role !== ROLES.SUB_ADMIN) return undefined
    let active = true
    branchSettingsApi.get()
      .then((res) => { if (active && res.data.data?.geofenceRadius) setGeofenceRadius(res.data.data.geofenceRadius) })
      .catch(() => {})
    return () => { active = false }
  }, [user.role])

  // Live pending-approvals count for the Sub-Admin Action Center badge.
  useEffect(() => {
    if (user.role !== ROLES.SUB_ADMIN) return undefined
    let active = true
    actionCenterApi.summary()
      .then((res) => { if (active) setActionCount(res.data.data?.total || 0) })
      .catch(() => {})
    return () => { active = false }
  }, [user.role, location.pathname])

  // Expand the dropdown if its child is active
  useEffect(() => {
    nav.forEach(item => {
      if (item.children) {
        if (item.children.some(child => location.pathname === child.path || location.pathname.startsWith(child.path + '/'))) {
          setExpandedDropdown(item.label)
        }
      }
    })
  }, [location.pathname, nav])

  function toggleDropdown(label) {
    setExpandedDropdown(prev => prev === label ? null : label)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Mobile backdrop when the drawer is open */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static collapsible on desktop, off-canvas drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out lg:static lg:z-auto lg:h-screen lg:sticky lg:top-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          desktopSidebarOpen
            ? 'w-64'
            : 'w-64 lg:w-0 lg:border-r-0 lg:overflow-hidden lg:pointer-events-none'
        }`}
        aria-label="Sidebar navigation"
      >
        <div className="flex h-full w-64 shrink-0 flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm">
                RE
              </div>
              <span className="font-semibold text-slate-900 tracking-tight">CRM</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                  setDesktopSidebarOpen(false)
                } else {
                  setMobileSidebarOpen(false)
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Hide sidebar"
              aria-label="Hide sidebar"
            >
              <span className="hidden lg:inline-flex">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </span>
              <span className="inline-flex lg:hidden text-base leading-none">✕</span>
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3 thin-scroll">
          {nav.map((item) => {
            if (item.type === 'group') {
              return (
                <div key={item.label} className="mt-5 mb-1.5 px-3 first:mt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {item.label}
                  </span>
                </div>
              )
            }

            if (item.children) {
              const isExpanded = expandedDropdown === item.label
              const hasActiveChild = item.children.some(child => location.pathname === child.path || location.pathname.startsWith(child.path + '/'))

              return (
                <div key={item.label} className="mb-1">
                  <button
                    onClick={() => toggleDropdown(item.label)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      hasActiveChild
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined w-5 text-[20px] leading-none opacity-90">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="material-symbols-outlined text-[18px] leading-none transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                  </button>
                  
                  {/* Accordion content */}
                  <div 
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col gap-1 pl-11 pr-3 pb-1">
                        {item.children.map(child => {
                          const isChildActive = location.pathname === child.path || location.pathname.startsWith(child.path + '/')
                          return (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              end={child.path.split('/').length <= 2}
                              className={`block rounded-md px-3 py-1.5 text-sm transition ${
                                isChildActive
                                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              {child.label}
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path.split('/').length <= 2}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <span className="material-symbols-outlined w-5 text-[20px] leading-none opacity-90">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.path === '/sub-admin/action' && actionCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {actionCount}
                  </span>
                )}
                {item.badge && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>


        {/* Branch Admin geofence card (mirrors the prototype's sidebar footer). */}
        {user.role === ROLES.SUB_ADMIN && (
          <div className="mx-3 mb-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current Geofence</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">{user.branch || 'Unassigned branch'}</div>
            <div className="text-xs font-medium text-blue-600">Radius: {geofenceRadius}m Active</div>
          </div>
        )}

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          {ROLE_LABELS[user.role]}
        </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-slate-200"
              title={desktopSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-label={desktopSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm font-medium text-slate-600">
              {ROLE_LABELS[user.role]} Workspace
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            {user.role === ROLES.SUPER_ADMIN ? (
              <NavLink to="/super-admin/profile" className="text-right block hover:bg-slate-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                <div className="text-sm font-medium text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </NavLink>
            ) : (
              <div className="text-right p-1.5">
                <div className="text-sm font-medium text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>
            )}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Logout confirmation popup */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Confirm Logout</h3>
            <p className="mt-2 text-sm text-slate-500">Are you sure you want to logout?</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
