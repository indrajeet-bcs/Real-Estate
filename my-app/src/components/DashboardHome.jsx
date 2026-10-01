import { useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { reportsApi } from '../api/resources.js'
import { useFetch } from '../hooks/useFetch.js'
import { Card, StatCard } from './ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES } from '../lib/constants.js'

// Shared dashboard landing. Pulls live KPIs from /reports/summary and renders
// the role's module shortcuts (which now link to real pages).
export default function DashboardHome({ title, subtitle, extraKpis = [], modules }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: summary } = useFetch(useCallback(() => reportsApi.summary(), []))

  const kpis = user?.role === ROLES.SALES_EXECUTIVE
    ? [
        { label: "Today's Follow-ups", value: summary?.todaysFollowups ?? 0 },
        { label: 'Assigned Leads', value: summary?.assignedLeads ?? 0 },
        { label: 'Site Visits', value: summary?.siteVisits ?? 0 },
        { label: 'Bookings', value: summary?.bookings ?? 0 },
        { label: 'Pending Tasks', value: summary?.pendingTasks ?? 0, onClick: () => navigate('/executive/pending-tasks') },
      ]
    : [
        { label: 'Total Customers', value: summary?.totalCustomers ?? 0 },
        { label: 'Booked', value: summary?.booked ?? 0 },
        { label: 'Confirmed Bookings', value: summary?.confirmedBookings ?? 0 },
        { label: 'Lost', value: summary?.lost ?? 0 },
        ...extraKpis,
      ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>

      <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-${kpis.length}`}>
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} hint={k.hint} onClick={k.onClick} />
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-600">Modules</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const inner = (
              <Card className="h-full p-5 transition hover:border-slate-300">
                <div className="mb-2 text-lg">{m.icon}</div>
                <div className="font-medium text-slate-900">{m.title}</div>
                <div className="mt-1 text-sm text-slate-600">{m.desc}</div>
                {!m.to && (
                  <div className="mt-3 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    Coming soon
                  </div>
                )}
              </Card>
            )
            return m.to ? (
              <Link key={m.title} to={m.to}>{inner}</Link>
            ) : (
              <div key={m.title}>{inner}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
