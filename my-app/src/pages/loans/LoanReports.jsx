import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, ExportMenu, Loader, ErrorState } from '../../components/ui.jsx'
import { loansApi } from '../../api/resources.js'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, exportRowsToCsv, exportRowsToExcel } from '../../lib/format.js'

const inrL = (n) => `₹${((Number(n) || 0) / 100000).toFixed(2)}L`

export default function LoanReports() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => loansApi.reports(), []))
  const r = data || { byBank: [], byStatus: [], byExecutive: [] }
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  const handleDownloadMasterReport = async (format = 'xlsx') => {
    setDownloading(true)
    try {
      const res = await loansApi.list({ limit: 1000 })
      const list = res.data?.data || res.data || []
      if (!list.length) {
        toast.info('No loan cases available')
        return
      }
      const dataRows = list.map((c) => ({
        'Case Code': c.caseCode || '—',
        'Customer': c.customerName || '—',
        'Booking': c.bookingLabel || '—',
        'Bank': c.bankName || c.bank || '—',
        'Loan Amount': c.loanAmountRequested || c.loanAmount || 0,
        'Sanctioned Amount': c.loanAmountSanctioned || 0,
        'Disbursed Amount': c.disbursedAmount || 0,
        'Status': c.status || '—',
        'Assigned Executive': c.assignedExecutive?.name || c.assignedExecutiveName || '—',
        'Sanction Date': formatDate(c.sanctionDate),
        'Disbursement Date': formatDate(c.disbursementDate),
        'Remarks': c.remarks || '—'
      }))

      if (format === 'csv') {
        exportRowsToCsv('loan-master-report.csv', dataRows)
        toast.success('Master loan report downloaded (CSV)')
      } else {
        exportRowsToExcel('loan-master-report.xlsx', dataRows, 'Loan Master')
        toast.success('Master loan report downloaded (Excel .xlsx)')
      }
    } catch {
      toast.error('Failed to download master loan report')
    } finally {
      setDownloading(false)
    }
  }

  const exportBank = (fmt = 'xlsx') => {
    const data = r.byBank.map((x) => ({ Bank: x._id || '—', Cases: x.cases, Sanctioned: x.sanctioned || 0, Disbursed: x.disbursed || 0 }))
    if (fmt === 'csv') exportRowsToCsv('loan-bank-summary.csv', data)
    else exportRowsToExcel('loan-bank-summary.xlsx', data, 'Bank Summary')
  }
  const exportStatus = (fmt = 'xlsx') => {
    const data = r.byStatus.map((x) => ({ Status: x._id || '—', Cases: x.cases }))
    if (fmt === 'csv') exportRowsToCsv('loan-status-summary.csv', data)
    else exportRowsToExcel('loan-status-summary.xlsx', data, 'Status Summary')
  }
  const exportExec = (fmt = 'xlsx') => {
    const data = r.byExecutive.map((x) => ({ Executive: x._id || '—', Cases: x.cases, Disbursed: x.disbursed || 0 }))
    if (fmt === 'csv') exportRowsToCsv('loan-executive-performance.csv', data)
    else exportRowsToExcel('loan-executive-performance.xlsx', data, 'Executive Performance')
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader
          title="Loan Reports"
          subtitle="Live insights across all loan processes."
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
          {rows.map((row, i) => (
            <tr key={i}>{cols.map((c) => <td key={c[1]} className="px-3 py-2 text-slate-700">{c[2] ? c[2](row[c[0]]) : (row[c[0]] ?? '—')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
