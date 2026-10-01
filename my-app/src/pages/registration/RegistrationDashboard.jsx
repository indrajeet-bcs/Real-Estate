import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, StatCard, Button, Loader, ErrorState } from '../../components/ui.jsx'
import { registrationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDate } from '../../lib/format.js'

export default function RegistrationDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => registrationsApi.dashboard(), []))
  const d = data || {}
  const recent = d.recent || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Registration Management"
        subtitle="Track property registrations from document collection to possession readiness."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('reports')}>View Reports</Button>
            <Button variant="primary" onClick={() => navigate('create')}>+ New Registration Case</Button>
          </>
        }
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Cases" value={d.total || 0} onClick={() => navigate('cases')} />
            <StatCard label="Docs Pending" value={d.documentsPending || 0} onClick={() => navigate('cases?status=Documents+Pending')} />
            <StatCard label="Appointments" value={d.appointmentScheduled || 0} onClick={() => navigate('cases?status=Appointment+Scheduled')} />
            <StatCard label="Completed" value={d.completed || 0} onClick={() => navigate('cases?status=Completed')} />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Registrations</h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate('cases')}>View All</Button>
                </div>
                {recent.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No registration cases yet.</p> : (
                  <div className="space-y-4">
                    {recent.map((c) => (
                      <div key={c._id} className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-3 transition last:border-0 last:pb-0 hover:bg-slate-50" onClick={() => navigate(c._id)}>
                        <div>
                          <p className="font-medium text-slate-900">{c.customerName || c.caseCode}</p>
                          <p className="text-xs text-slate-500">{c.registrationType} • {c.branch || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-700">{formatDate(c.expectedRegistrationDate || c.appointmentDate)}</p>
                          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{c.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            <div>
              <Card className="border-orange-100 bg-orange-50/50 p-5">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Action Items</h3>
                {(d.documentsPending || 0) > 0 ? (
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-orange-500">warning</span>
                    <div>
                      <p className="font-medium text-slate-900">{d.documentsPending} Cases Pending Documents</p>
                      <p className="text-sm text-slate-600">Awaiting document verification to schedule appointments.</p>
                      <Button variant="secondary" size="sm" className="mt-2 bg-white" onClick={() => navigate('cases?status=Documents+Pending')}>Review Documents</Button>
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-500">No pending actions.</p>}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
