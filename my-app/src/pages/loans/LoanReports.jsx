import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, ExportMenu, Loader, ErrorState } from '../../components/ui.jsx'
import { loansApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { exportRowsToCsv } from '../../lib/format.js'

const inrL = (n) => `₹${((Number(n) || 0) / 100000).toFixed(2)}L`

export default function LoanReports() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => loansApi.reports(), []))
  const r = data || { byBank: [], byStatus: [], byExecutive: [] }

  const exportBank = () => exportRowsToCsv('loan-bank-summary.csv', r.byBank.map((x) => ({ Bank: x._id || '—', Cases: x.cases, Sanctioned: x.sanctioned || 0, Disbursed: x.disbursed || 0 })))
  const exportStatus = () => exportRowsToCsv('loan-status-summary.csv', r.byStatus.map((x) => ({ Status: x._id || '—', Cases: x.cases })))
  const exportExec = () => exportRowsToCsv('loan-executive-performance.csv', r.byExecutive.map((x) => ({ Executive: x._id || '—', Cases: x.cases, Disbursed: x.disbursed || 0 })))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader title="Loan Reports" subtitle="Live insights across all loan processes." />
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ReportCard title="Bank-wise Summary" subtitle="Volume and amounts per financial institution." onExport={exportBank} disabled={r.byBank.length === 0}>
            <MiniTable rows={r.byBank} cols={[['_id', 'Bank'], ['cases', 'Cases'], ['sanctioned', 'Sanctioned', inrL], ['disbursed', 'Disbursed', inrL]]} />
          </ReportCard>
          <ReportCard title="Status Summary" subtitle="Case count by loan status." onExport={exportStatus} disabled={r.byStatus.length === 0}>
            <MiniTable rows={r.byStatus} cols={[['_id', 'Status'], ['cases', 'Cases']]} />
          </ReportCard>
          <ReportCard title="Executive Performance" subtitle="Cases and disbursement per executive." onExport={exportExec} disabled={r.byExecutive.length === 0}>
            <MiniTable rows={r.byExecutive} cols={[['_id', 'Executive'], ['cases', 'Cases'], ['disbursed', 'Disbursed', inrL]]} />
          </ReportCard>
        </div>
      )}
    </div>
  )
}

function ReportCard({ title, subtitle, onExport, disabled, children }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex-1">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mb-4 text-sm text-slate-500">{subtitle}</p>
        <div className="mb-4">{children}</div>
      </div>
      <ExportMenu items={[{ key: 'csv', label: 'Export to CSV', onClick: onExport }]} label="Download Report" align="left" disabled={disabled} />
    </Card>
  )
}

function MiniTable({ rows, cols }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-slate-400">No data yet.</p>
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{cols.map((c) => <th key={c[1]} className="px-3 py-2 font-medium">{c[1]}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i}>{cols.map((c) => <td key={c[1]} className="px-3 py-2 text-slate-700">{c[2] ? c[2](row[c[0]]) : (row[c[0]] ?? '—')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
