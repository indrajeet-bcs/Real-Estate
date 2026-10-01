import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatCard, Card, Button, Loader, ErrorState } from '../../components/ui.jsx'
import { loansApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'

const inrL = (n) => `₹${((Number(n) || 0) / 100000).toFixed(2)}L`

export default function LoansDashboard() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => loansApi.dashboard(), []))
  const d = data || {}
  const recent = d.recent || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Loan Management"
        subtitle="Track customer property loans from application to final disbursement."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('reports')}>View Reports</Button>
            <Button variant="primary" onClick={() => navigate('create')}>+ New Loan Case</Button>
          </>
        }
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total Cases" value={d.total || 0} onClick={() => navigate('cases')} />
            <StatCard label="Docs Pending" value={d.docsPending || 0} onClick={() => navigate('cases?status=Documents Pending')} />
            <StatCard label="Under Review" value={d.underReview || 0} onClick={() => navigate('cases?status=Under Review')} />
            <StatCard label="Sanctioned" value={d.sanctioned || 0} onClick={() => navigate('cases?status=Sanctioned')} />
            <StatCard label="Fully Disbursed" value={d.fullyDisbursed || 0} onClick={() => navigate('cases?status=Fully Disbursed')} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-900">Recent Loan Cases</h3>
                <Button variant="ghost" size="sm" onClick={() => navigate('cases')}>View All</Button>
              </div>
              {recent.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No loan cases yet.</p> : (
                <div className="space-y-4">
                  {recent.map((c) => (
                    <div key={c._id} className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-3 transition last:border-0 last:pb-0 hover:bg-slate-50" onClick={() => navigate(c._id)}>
                      <div>
                        <p className="font-medium text-slate-900">{c.customerName || c.caseCode}</p>
                        <p className="text-xs text-slate-500">{c.bank || '—'} • {c.loanType}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">{inrL(c.loanAmount)}</p>
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 text-lg font-medium text-slate-900">Action Items</h3>
              {(d.docsPending || 0) === 0 ? (
                <p className="text-sm text-slate-500">No pending actions at the moment.</p>
              ) : (
                <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-orange-600">warning</span>
                    <div>
                      <h4 className="font-medium text-orange-900">{d.docsPending} Cases Pending Documents</h4>
                      <p className="mt-1 text-sm text-orange-700">Customers are waiting for document verification before application submission.</p>
                      <Button variant="secondary" size="sm" className="mt-3 bg-white" onClick={() => navigate('cases?status=Documents Pending')}>Review Documents</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
