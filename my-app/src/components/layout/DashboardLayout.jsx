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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close the mobile sidebar drawer whenever the route changes.
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

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
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Mobile backdrop when the drawer is open */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar — static on desktop, off-canvas drawer on mobile */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            RE
          </div>
          <span className="font-semibold text-slate-900">CRM</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400 hover:text-slate-700 lg:hidden" aria-label="Close menu">✕</button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
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
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">☰</button>
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
              onClick={handleLogout}
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
    </div>
  )
}
