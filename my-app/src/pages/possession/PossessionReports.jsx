import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, ExportMenu, Loader, ErrorState } from '../../components/ui.jsx'
import { possessionsApi } from '../../api/resources.js'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, exportRowsToCsv, exportRowsToExcel } from '../../lib/format.js'

export default function PossessionReports() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => possessionsApi.reports(), []))
  const r = data || { byStatus: [], byEmployee: [], byProject: [] }
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  const handleDownloadMasterReport = async (format = 'xlsx') => {
    setDownloading(true)
    try {
      const res = await possessionsApi.list({ limit: 1000 })
      const list = res.data?.data || res.data || []
      if (!list.length) {
        toast.info('No possession cases available')
        return
      }
      const dataRows = list.map((c) => ({
        'Case Code': c.caseCode || '—',
        'Customer': c.customerName || '—',
        'Booking': c.bookingLabel || '—',
        'Project': c.project || '—',
        'Unit': c.unitNumber || '—',
        'Status': c.status || '—',
        'Key Handover Date': formatDate(c.keyHandoverDate),
        'Actual Possession Date': formatDate(c.actualPossessionDate),
        'Assigned Employee': c.assignedEmployee?.name || c.assignedEmployeeName || '—',
        'Remarks': c.remarks || '—'
      }))

      if (format === 'csv') {
        exportRowsToCsv('possession-master-report.csv', dataRows)
        toast.success('Master possession report downloaded (CSV)')
      } else {
        exportRowsToExcel('possession-master-report.xlsx', dataRows, 'Possession Master')
        toast.success('Master possession report downloaded (Excel .xlsx)')
      }
    } catch {
      toast.error('Failed to download master possession report')
    } finally {
      setDownloading(false)
    }
  }

  const exportStatus = (fmt = 'xlsx') => {
    const data = r.byStatus.map((x) => ({ Status: x._id || '—', Cases: x.cases }))
    if (fmt === 'csv') exportRowsToCsv('possession-status.csv', data)
    else exportRowsToExcel('possession-status.xlsx', data, 'Status Summary')
  }
  const exportEmp = (fmt = 'xlsx') => {
    const data = r.byEmployee.map((x) => ({ Employee: x._id || '—', Cases: x.cases, Completed: x.completed || 0 }))
    if (fmt === 'csv') exportRowsToCsv('possession-employee.csv', data)
    else exportRowsToExcel('possession-employee.xlsx', data, 'Employee Performance')
  }
  const exportProj = (fmt = 'xlsx') => {
    const data = r.byProject.map((x) => ({ Project: x._id || '—', Cases: x.cases }))
    if (fmt === 'csv') exportRowsToCsv('possession-project.csv', data)
    else exportRowsToExcel('possession-project.xlsx', data, 'Project Summary')
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader
          title="Possession Reports"
          subtitle="Live insights across all handover cases."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => handleDownloadMasterReport('xlsx')}
                disabled={downloading}
                className="inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                <span>{downloading ? 'Downloading…' : 'Download Excel Report'}</span>
              </Button>
              <ExportMenu
                label="Export"
                disabled={downloading}
                loading={downloading}
                items={[
                  { key: 'xlsx', label: 'Download Excel (.xlsx)', icon: 'table_view', onClick: () => handleDownloadMasterReport('xlsx') },
                  { key: 'csv', label: 'Download CSV (.csv)', icon: 'description', onClick: () => handleDownloadMasterReport('csv') },
                ]}
              />
            </div>
          }
        />
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ReportCard title="Status Summary" subtitle="Case count by status." onExport={exportStatus} disabled={r.byStatus.length === 0}>
            <MiniTable rows={r.byStatus} cols={[['_id', 'Status'], ['cases', 'Cases']]} />
          </ReportCard>
          <ReportCard title="Employee Performance" subtitle="Cases and completions per employee." onExport={exportEmp} disabled={r.byEmployee.length === 0}>
            <MiniTable rows={r.byEmployee} cols={[['_id', 'Employee'], ['cases', 'Cases'], ['completed', 'Completed']]} />
          </ReportCard>
          <ReportCard title="By Project" subtitle="Handover volume per project." onExport={exportProj} disabled={r.byProject.length === 0}>
            <MiniTable rows={r.byProject} cols={[['_id', 'Project'], ['cases', 'Cases']]} />
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
      <ExportMenu
        items={[
          { key: 'xlsx', label: 'Export to Excel (.xlsx)', icon: 'table_view', onClick: () => onExport('xlsx') },
          { key: 'csv', label: 'Export to CSV (.csv)', icon: 'description', onClick: () => onExport('csv') },
        ]}
        label="Download Report"
        align="left"
        disabled={disabled}
      />
    </Card>
  )
}

function MiniTable({ rows, cols }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-slate-400">No data yet.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100 thin-scroll">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{cols.map((c) => <th key={c[1]} className="px-3 py-2 font-medium">{c[1]}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => <tr key={i}>{cols.map((c) => <td key={c[1]} className="px-3 py-2 text-slate-700">{row[c[0]] ?? '—'}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
