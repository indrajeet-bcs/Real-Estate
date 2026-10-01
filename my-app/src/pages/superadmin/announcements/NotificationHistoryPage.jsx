import { useState, useCallback } from 'react'
import { notificationHistoryApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { formatDate } from '../../../lib/format.js'
import { PageHeader, Button, Input, Select, Loader, ErrorState, Card, Modal, Table } from '../../../components/ui.jsx'

function DeliveryBadge({ status }) {
  const colors = {
    'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
    'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Failed': 'bg-red-50 text-red-700 border-red-200'
  }
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[status] || colors.Pending}`}>{status}</span>
}

export default function NotificationHistoryPage() {
  const { data, loading, error, refetch } = useFetch(useCallback(() => notificationHistoryApi.list(), []))
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)

  const filteredData = (data || []).filter(a => {
    if (search && !a.announcement?.title?.toLowerCase().includes(search.toLowerCase()) && !a.notificationId.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && a.deliveryStatus !== statusFilter) return false
    return true
  })

  const kpis = {
    total: data?.length || 0,
    delivered: data?.filter(a => a.deliveryStatus === 'Delivered').length || 0,
    failed: data?.filter(a => a.deliveryStatus === 'Failed').length || 0,
    pending: data?.filter(a => a.deliveryStatus === 'Pending').length || 0,
  }

  const columns = [
    { key: 'notificationId', header: 'Notification ID', render: (r) => <span className="font-medium text-slate-800">{r.notificationId}</span> },
    { key: 'announcement', header: 'Announcement Title', render: (r) => r.announcement?.title },
    { key: 'audience', header: 'Audience', render: (r) => r.audienceType },
    { key: 'totalCompanies', header: 'Total Companies' },
    { key: 'deliveryStatus', header: 'Delivery Status', render: (r) => <DeliveryBadge status={r.deliveryStatus} /> },
    { key: 'sentBy', header: 'Sent By', render: (r) => r.sentBy?.name || 'System' },
    { key: 'sentDate', header: 'Sent On', render: (r) => formatDate(r.sentDate) },
    {
      key: 'actions',
      header: <div className="text-right">Actions</div>,
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSelectedRecord(r)}>View Details</Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification History"
        subtitle="Review the delivery logs for all platform announcements."
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-sm text-slate-500">Total Notifications</div><div className="text-2xl font-semibold">{kpis.total}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Delivered</div><div className="text-2xl font-semibold text-emerald-600">{kpis.delivered}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Failed</div><div className="text-2xl font-semibold text-red-600">{kpis.failed}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Pending</div><div className="text-2xl font-semibold text-amber-600">{kpis.pending}</div></Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input placeholder="Search by ID or title..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Delivered">Delivered</option>
              <option value="Failed">Failed</option>
            </Select>
          </div>
        </div>

        {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <Table columns={columns} rows={filteredData} empty="No notification history found." />
        )}
      </Card>

      {selectedRecord && (
        <Modal 
          open 
          title={`Delivery Details: ${selectedRecord.notificationId}`} 
          onClose={() => setSelectedRecord(null)}
          footer={<Button onClick={() => setSelectedRecord(null)}>Close</Button>}
        >
          <div className="space-y-4 text-sm">
            <div><span className="text-slate-500 block mb-1">Announcement Title</span><div className="font-medium text-lg">{selectedRecord?.announcement?.title}</div></div>
            
            <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-3 my-3">
              <div><span className="text-slate-500 block mb-1">Delivery Status</span><DeliveryBadge status={selectedRecord?.deliveryStatus} /></div>
              <div><span className="text-slate-500 block mb-1">Sent Date</span><div>{formatDate(selectedRecord?.sentDate)}</div></div>
              <div><span className="text-slate-500 block mb-1">Sent By</span><div>{selectedRecord?.sentBy?.name || 'System'}</div></div>
              <div><span className="text-slate-500 block mb-1">Total Companies Reached</span><div>{selectedRecord?.totalCompanies}</div></div>
            </div>

            <div><span className="text-slate-500 block mb-1">Audience</span><div>{selectedRecord?.audienceType}</div></div>
            
            {selectedRecord?.audienceType === 'Selected Companies' && (
              <div>
                <span className="text-slate-500 block mb-1">Recipient Companies</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedRecord?.targetCompanies || []).map(c => (
                    <span key={c._id} className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-xs">{c.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
