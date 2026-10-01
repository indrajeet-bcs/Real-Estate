import { useState, useCallback } from 'react'
import { announcementsApi, firmsApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { useToast } from '../../../context/ToastContext.jsx'
import { formatDate } from '../../../lib/format.js'
import { PageHeader, Button, Input, Select, Loader, ErrorState, Card, Modal, Table, Textarea } from '../../../components/ui.jsx'

function StatusBadge({ status }) {
  const colors = {
    'Draft': 'bg-slate-100 text-slate-700 border-slate-200',
    'Published': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Expired': 'bg-amber-50 text-amber-700 border-amber-200'
  }
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[status] || colors.Draft}`}>{status}</span>
}

export default function AnnouncementsPage() {
  const toast = useToast()
  
  const { data, loading, error, refetch } = useFetch(useCallback(() => announcementsApi.list(), []))
  const { data: firms } = useFetch(useCallback(() => firmsApi.list({ limit: 100 }), []))
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [actionModal, setActionModal] = useState(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [busy, setBusy] = useState(false)
  
  // Form state
  const [form, setForm] = useState({ title: '', message: '', audienceType: 'All Companies', targetCompanies: [], status: 'Draft' })

  const openModal = (type, ann = null) => {
    setSelectedAnnouncement(ann)
    setActionModal(type)
    if (ann && (type === 'edit' || type === 'view')) {
      setForm({ 
        title: ann.title, 
        message: ann.message, 
        audienceType: ann.audienceType, 
        targetCompanies: ann.targetCompanies?.map(c => c._id) || [],
        status: ann.status 
      })
    } else {
      setForm({ title: '', message: '', audienceType: 'All Companies', targetCompanies: [], status: 'Draft' })
    }
  }

  const handleSave = async () => {
    if (!form.title || !form.message) {
      toast.error('Title and message are required')
      return
    }
    setBusy(true)
    try {
      if (actionModal === 'add') {
        await announcementsApi.create(form)
        toast.success('Announcement created')
      } else if (actionModal === 'edit') {
        await announcementsApi.update(selectedAnnouncement._id, form)
        toast.success('Announcement updated')
      }
      refetch()
      setActionModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleAction = async (actionType, ann) => {
    setBusy(true)
    try {
      if (actionType === 'delete') {
        await announcementsApi.remove(ann._id)
        toast.success('Announcement deleted')
      } else if (actionType === 'publish') {
        await announcementsApi.update(ann._id, { status: 'Published' })
        toast.success('Announcement published')
      } else if (actionType === 'unpublish') {
        await announcementsApi.update(ann._id, { status: 'Draft' })
        toast.success('Announcement unpublished')
      }
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const filteredData = (data || []).filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })

  const kpis = {
    total: data?.length || 0,
    published: data?.filter(a => a.status === 'Published').length || 0,
    draft: data?.filter(a => a.status === 'Draft').length || 0,
    expired: data?.filter(a => a.status === 'Expired').length || 0,
  }

  const columns = [
    { key: 'title', header: 'Title', render: (r) => <span className="font-medium text-slate-800">{r.title}</span> },
    { key: 'audience', header: 'Audience', render: (r) => r.audienceType },
    { key: 'publishDate', header: 'Publish Date', render: (r) => formatDate(r.publishDate) || '—' },
    { key: 'expiryDate', header: 'Expiry Date', render: (r) => formatDate(r.expiryDate) || '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdBy', header: 'Created By', render: (r) => r.createdBy?.name || '—' },
    {
      key: 'actions',
      header: <div className="text-right">Actions</div>,
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openModal('view', r)}>View</Button>
          <Button size="sm" variant="secondary" onClick={() => openModal('edit', r)}>Edit</Button>
          {r.status === 'Draft' && <Button size="sm" variant="success" onClick={() => handleAction('publish', r)}>Publish</Button>}
          {r.status === 'Published' && <Button size="sm" variant="secondary" onClick={() => handleAction('unpublish', r)}>Unpublish</Button>}
          <Button size="sm" variant="danger" onClick={() => { if(confirm('Are you sure?')) handleAction('delete', r) }}>Delete</Button>
        </div>
      )
    }
  ]

  const handleCompanySelect = (e) => {
    const value = Array.from(e.target.selectedOptions, option => option.value)
    setForm({ ...form, targetCompanies: value })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Manage platform-wide announcements and notifications."
        actions={<Button onClick={() => openModal('add')}>+ Create Announcement</Button>}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-sm text-slate-500">Total</div><div className="text-2xl font-semibold">{kpis.total}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Published</div><div className="text-2xl font-semibold text-emerald-600">{kpis.published}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Draft</div><div className="text-2xl font-semibold text-slate-600">{kpis.draft}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Expired</div><div className="text-2xl font-semibold text-amber-600">{kpis.expired}</div></Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input placeholder="Search by title..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
              <option value="Expired">Expired</option>
            </Select>
          </div>
        </div>

        {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
          <Table columns={columns} rows={filteredData} empty="No announcements found." />
        )}
      </Card>

      {(actionModal === 'add' || actionModal === 'edit') && (
        <Modal 
          open 
          title={actionModal === 'add' ? 'Create Announcement' : 'Edit Announcement'} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              {actionModal === 'add' && <Button variant="secondary" disabled={busy} onClick={() => { form.status = 'Draft'; handleSave(); }}>Save as Draft</Button>}
              <Button variant="primary" disabled={busy} onClick={() => { if(actionModal === 'add') form.status = 'Published'; handleSave(); }}>
                {actionModal === 'add' ? 'Publish Now' : 'Update'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input label="Announcement Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Textarea label="Announcement Message *" rows={4} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            
            <Select label="Audience" value={form.audienceType} onChange={e => setForm({ ...form, audienceType: e.target.value })}>
              <option value="All Companies">All Companies</option>
              <option value="Selected Companies">Selected Companies</option>
            </Select>

            {form.audienceType === 'Selected Companies' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Companies</label>
                <select 
                  multiple 
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={form.targetCompanies}
                  onChange={handleCompanySelect}
                  size={4}
                >
                  {(firms?.docs || firms || []).map(f => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {actionModal === 'view' && (
        <Modal 
          open 
          title="Announcement Details" 
          onClose={() => setActionModal(null)}
          footer={<Button onClick={() => setActionModal(null)}>Close</Button>}
        >
          <div className="space-y-4 text-sm">
            <div><span className="text-slate-500 block mb-1">Title</span><div className="font-medium text-lg">{selectedAnnouncement?.title}</div></div>
            <div><span className="text-slate-500 block mb-1">Status</span><StatusBadge status={selectedAnnouncement?.status} /></div>
            <div><span className="text-slate-500 block mb-1">Audience</span><div>{selectedAnnouncement?.audienceType}</div></div>
            
            {selectedAnnouncement?.audienceType === 'Selected Companies' && (
              <div>
                <span className="text-slate-500 block mb-1">Selected Companies</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedAnnouncement?.targetCompanies || []).map(c => (
                    <span key={c._id} className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-xs">{c.name}</span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-500 block mb-1">Publish Date</span><div>{formatDate(selectedAnnouncement?.publishDate) || '—'}</div></div>
              <div><span className="text-slate-500 block mb-1">Expiry Date</span><div>{formatDate(selectedAnnouncement?.expiryDate) || '—'}</div></div>
            </div>
            
            <div>
              <span className="text-slate-500 block mb-1">Message</span>
              <div className="p-3 bg-slate-50 rounded border border-slate-100 whitespace-pre-wrap">{selectedAnnouncement?.message}</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
