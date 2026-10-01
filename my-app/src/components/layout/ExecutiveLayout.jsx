import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import NotificationBell from './NotificationBell.jsx'

// Mobile phone-frame shell for the Sales Executive (ported from the prototype's
// mobile simulator). Device chrome + bottom nav + Quick-Add FAB.
// 4 tabs + a center spacer for the floating FAB. Builders lives on Home.
const TABS = [
  { to: '/executive', label: 'Home', icon: '⌂', end: true },
  { to: '/executive/customers', label: 'Customers', icon: '☰' },
  null, // center FAB slot
  { to: '/executive/pipeline', label: 'Pipeline', icon: '▤' },
  { to: '/executive/profile', label: 'Profile', icon: '☺' },
]

const TITLES = [
  [/\/executive\/customers\/.+/, 'Customer 360°'],
  [/\/executive\/customers$/, 'My Customers'],
  [/\/executive\/builders/, 'Builders'],
  [/\/executive\/pipeline/, 'Pipeline'],
  [/\/executive\/profile/, 'Profile'],
  [/\/executive\/followups/, 'Follow-ups'],
  [/\/executive\/visits/, 'Site Visits'],
  [/\/executive\/bookings/, 'Bookings'],
  [/\/executive\/attendance/, 'Attendance'],
  [/\/executive\/report/, 'Daily Report'],
  [/\/executive\/pending-tasks/, 'Pending Tasks'],
  [/\/executive$/, 'RERASales Mobile'],
]

const FAB_ACTIONS = [
  { label: 'New Lead', icon: '➕', to: '/executive/customers?new=1' },
  { label: 'Log Follow-up', icon: '↻', to: '/executive/followups' },
  { label: 'Schedule Visit', icon: '⌖', to: '/executive/visits' },
  { label: 'New Booking', icon: '✓', to: '/executive/bookings' },
  { label: 'Daily Report', icon: '▤', to: '/executive/report' },
  { label: 'Request Leave', icon: '◷', to: '/executive/profile?leave=1' },
]

export default function ExecutiveLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [fabOpen, setFabOpen] = useState(false)

  const title = (TITLES.find(([re]) => re.test(location.pathname)) || [null, 'RERASales'])[1]

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-200 p-0 sm:p-4">
      {/* Device frame */}
      <div className="relative flex h-screen w-full max-w-[430px] flex-col overflow-hidden bg-slate-50 sm:h-[min(92vh,900px)] sm:rounded-[2.25rem] sm:border-[10px] sm:border-slate-900 sm:shadow-2xl">

        {/* Status bar */}
        <div className="flex items-center justify-between bg-slate-900 px-6 py-1.5 text-[10px] font-medium text-white">
          <span>9:41</span>
          <div className="flex items-center gap-1.5"><span>5G</span><span>􀛨</span><span>100%</span></div>
        </div>

        {/* App header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">RERASales Mobile CRM</div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={handleLogout} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Exit</button>
          </div>
        </header>

        {/* Screen */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 pb-24">
          <Outlet />
        </main>

        {/* Quick-Add FAB + action sheet */}
        {fabOpen && (
          <>
            <div className="absolute inset-0 z-20 bg-slate-900/30" onClick={() => setFabOpen(false)} />
            <div className="absolute inset-x-0 bottom-16 z-30 mx-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
              <div className="grid grid-cols-3 gap-2">
                {FAB_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => { setFabOpen(false); navigate(a.to) }}
                    className="flex flex-col items-center gap-1 rounded-xl p-3 text-center transition hover:bg-slate-50"
                  >
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-[11px] font-medium text-slate-700">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="absolute bottom-11 left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-lg shadow-blue-600/40 transition hover:bg-blue-700"
          aria-label="Quick add"
        >
          <span className={`transition-transform ${fabOpen ? 'rotate-45' : ''}`}>+</span>
        </button>

        {/* Bottom nav (center slot left empty for the FAB) */}
        <nav className="grid grid-cols-5 border-t border-slate-200 bg-white">
          {TABS.map((t, i) => t ? (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <span className="text-base leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ) : <div key={i} aria-hidden />)}
        </nav>
      </div>
    </div>
  )
}
