import { useState, useCallback, useMemo } from 'react'
import { leavesApi, attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, StatCard, Button, Table, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'
import AttendanceReviewPage from './AttendanceReviewPage.jsx'

export default function AttendanceLeavesPage() {
  const [tab, setTab] = useState('attendance')
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <TabButton active={tab === 'attendance'} onClick={() => setTab('attendance')}>Attendance</TabButton>
        <TabButton active={tab === 'leaves'} onClick={() => setTab('leaves')}>Leave Management</TabButton>
        <TabButton active={tab === 'corrections'} onClick={() => setTab('corrections')}>Corrections</TabButton>
      </div>
      {tab === 'attendance' && <AttendanceReviewPage />}
      {tab === 'leaves' && <LeavesPanel />}
      {tab === 'corrections' && <CorrectionsPanel />}
    </div>
  )
}

function CorrectionsPanel() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => attendanceApi.corrections(), []))
  const rows = data || []
  const pending = rows.filter((r) => r.status === 'pending').length
  const canDecide = can('attendance', 'view') // Sub-Admin/Admin

  async function decide(r, decision) {
    let note
    if (decision === 'reject') {
      note = window.prompt('Rejection remarks are required:')
      if (note == null) return
      if (!note.trim()) { window.alert('Remarks are mandatory to reject.'); return }
    }
    try { await attendanceApi.decideCorrection(r._id, { decision, note }); toast.success(`Correction ${decision === 'approve' ? 'approved' : 'rejected'}`); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.employee?.name || '—'}</div><div className="text-xs text-slate-500">{r.employee?.employeeId || '—'}</div></div>
    ) },
    { key: 'date', header: 'Date' },
    { key: 'in', header: 'Requested Check-In', render: (r) => r.requestedCheckInAt ? formatDate(r.requestedCheckInAt, true) : '—' },
    { key: 'out', header: 'Requested Check-Out', render: (r) => r.requestedCheckOutAt ? formatDate(r.requestedCheckOutAt, true) : '—' },
    { key: 'reason', header: 'Reason', render: (r) => <span className="text-xs text-slate-600">{r.reason}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'} /> },
    { key: 'actions', header: '', render: (r) => canDecide && r.status === 'pending' && (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="success" onClick={() => decide(r, 'approve')}>Approve</Button>
        <Button size="sm" variant="danger" onClick={() => decide(r, 'reject')}>Reject</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Attendance Corrections" subtitle="Review employee attendance-correction requests." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending" value={pending} />
        <StatCard label="Approved" value={rows.filter((r) => r.status === 'approved').length} />
        <StatCard label="Rejected" value={rows.filter((r) => r.status === 'rejected').length} />
        <StatCard label="Total" value={rows.length} />
      </div>
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={rows} empty="No correction requests." />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    }`}>{children}</button>
  )
}

function LeavesPanel() {
  const { can } = useAuth()
  const toast = useToast()
  const [historyFor, setHistoryFor] = useState(null)
  const { data, loading, error, refetch } = useFetch(useCallback(() => leavesApi.list(), []))
  const rows = data || []

  const kpis = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    total: rows.length,
  }), [rows])

  async function approve(l) {
    try { await leavesApi.approve(l._id); toast.success('Leave approved'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }
  async function reject(l) {
    const note = window.prompt('Rejection remarks are required:')
    if (note == null) return
    if (!note.trim()) { window.alert('Remarks are mandatory to reject a leave.'); return }
    try { await leavesApi.reject(l._id, note.trim()); toast.success('Leave rejected'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.employee?.name || '—'}</div><div className="text-xs text-slate-500">{r.employee?.branch || '—'}</div></div>
    ) },
    { key: 'type', header: 'Leave Type', render: (r) => titleCase(r.type) },
    { key: 'dates', header: 'Dates', render: (r) => `${formatDate(r.startDate)} → ${formatDate(r.endDate)}` },
    { key: 'days', header: 'Days', render: (r) => r.days },
    { key: 'applied', header: 'Applied On', render: (r) => formatDate(r.createdAt) },
    { key: 'reason', header: 'Reason', render: (r) => <span className="text-xs text-slate-600">{r.reason}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setHistoryFor(r.employee)}>History</Button>
        {can('leave', 'approve') && r.status === 'pending' && (
          <>
            <Button size="sm" variant="success" onClick={() => approve(r)}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => reject(r)}>Reject</Button>
          </>
        )}
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Leave Management" subtitle="Review, approve or reject team leave requests." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending Requests" value={kpis.pending} />
        <StatCard label="Approved" value={kpis.approved} />
        <StatCard label="Rejected" value={kpis.rejected} />
        <StatCard label="Total Requests" value={kpis.total} />
      </div>
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={rows} empty="No leave requests" />
      )}
      {historyFor && <LeaveHistoryModal employee={historyFor} allLeaves={rows} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function LeaveHistoryModal({ employee, allLeaves, onClose }) {
  const empId = employee?._id || employee
  const history = allLeaves.filter((l) => String(l.employee?._id || l.employee) === String(empId))
  const columns = [
    { key: 'type', header: 'Type', render: (r) => titleCase(r.type) },
    { key: 'dates', header: 'Dates', render: (r) => `${formatDate(r.startDate)} → ${formatDate(r.endDate)}` },
    { key: 'days', header: 'Days', render: (r) => r.days },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'note', header: 'Remarks', render: (r) => <span className="text-xs text-slate-500">{r.decisionNote || '—'}</span> },
  ]
  return (
    <Modal open onClose={onClose} wide title={`Leave History — ${employee?.name || ''}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <Table columns={columns} rows={history} empty="No leave history." />
    </Modal>
  )
}
