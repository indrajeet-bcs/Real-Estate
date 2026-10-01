import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, StatCard, Button, Loader, ErrorState } from '../../components/ui.jsx'
import { possessionsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDate } from '../../lib/format.js'

export default function PossessionDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => possessionsApi.dashboard(), []))
  const d = data || {}
  const recent = d.recent || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Possession Management"
        subtitle="Track handover readiness, scheduling and key handover to customers."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('reports')}>View Reports</Button>
            <Button variant="primary" onClick={() => navigate('create')}>+ New Possession Case</Button>
          </>
        }
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Cases" value={d.total || 0} onClick={() => navigate('cases')} />
            <StatCard label="Readiness Check" value={d.readinessCheck || 0} onClick={() => navigate('cases?status=Readiness+Check')} />
            <StatCard label="Scheduled" value={d.scheduled || 0} onClick={() => navigate('cases?status=Scheduled')} />
            <StatCard label="Completed" value={d.completed || 0} onClick={() => navigate('cases?status=Completed')} />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Possession Cases</h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate('cases')}>View All</Button>
                </div>
                {recent.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No possession cases yet.</p> : (
                  <div className="space-y-4">
                    {recent.map((c) => (
                      <div key={c._id} className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-3 transition last:border-0 last:pb-0 hover:bg-slate-50" onClick={() => navigate(c._id)}>
                        <div>
                          <p className="font-medium text-slate-900">{c.customerName || c.caseCode}</p>
                          <p className="text-xs text-slate-500">{c.project || '—'} • {c.unitNumber || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-700">{formatDate(c.scheduledDate || c.expectedPossessionDate)}</p>
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
                {(d.readinessCheck || 0) > 0 ? (
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-orange-500">warning</span>
                    <div>
                      <p className="font-medium text-slate-900">{d.readinessCheck} Cases in Readiness Check</p>
                      <p className="text-sm text-slate-600">Complete the readiness checklist before scheduling handover.</p>
                      <Button variant="secondary" size="sm" className="mt-2 bg-white" onClick={() => navigate('cases?status=Readiness+Check')}>Review Checklist</Button>
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
