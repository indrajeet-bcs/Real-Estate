import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, ExportMenu, Loader, ErrorState } from '../../components/ui.jsx'
import { registrationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { exportRowsToCsv } from '../../lib/format.js'

export default function RegistrationReports() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => registrationsApi.reports(), []))
  const r = data || { byStatus: [], byType: [], byEmployee: [] }

  const exportStatus = () => exportRowsToCsv('registration-status.csv', r.byStatus.map((x) => ({ Status: x._id || '—', Cases: x.cases })))
  const exportType = () => exportRowsToCsv('registration-type.csv', r.byType.map((x) => ({ Type: x._id || '—', Cases: x.cases })))
  const exportEmp = () => exportRowsToCsv('registration-employee.csv', r.byEmployee.map((x) => ({ Employee: x._id || '—', Cases: x.cases, Completed: x.completed || 0 })))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader title="Registration Reports" subtitle="Live insights across all registration cases." />
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ReportCard title="Status Summary" subtitle="Case count by status." onExport={exportStatus} disabled={r.byStatus.length === 0}>
            <MiniTable rows={r.byStatus} cols={[['_id', 'Status'], ['cases', 'Cases']]} />
          </ReportCard>
          <ReportCard title="By Registration Type" subtitle="Volume per registration type." onExport={exportType} disabled={r.byType.length === 0}>
            <MiniTable rows={r.byType} cols={[['_id', 'Type'], ['cases', 'Cases']]} />
          </ReportCard>
          <ReportCard title="Employee Performance" subtitle="Cases and completions per employee." onExport={exportEmp} disabled={r.byEmployee.length === 0}>
            <MiniTable rows={r.byEmployee} cols={[['_id', 'Employee'], ['cases', 'Cases'], ['completed', 'Completed']]} />
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
          {rows.map((row, i) => <tr key={i}>{cols.map((c) => <td key={c[1]} className="px-3 py-2 text-slate-700">{row[c[0]] ?? '—'}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
