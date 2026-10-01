import { useState, useCallback } from 'react'
import { supportMembersApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { useToast } from '../../../context/ToastContext.jsx'
import { PageHeader, Button, Input, Loader, ErrorState, Modal, Table } from '../../../components/ui.jsx'

export default function SupportMembersPage() {
  const toast = useToast()
  
  const { data, loading, error, refetch } = useFetch(useCallback(() => supportMembersApi.list(), []))
  
  const [actionModal, setActionModal] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [form, setForm] = useState({ name: '', role: '', email: '', mobile: '' })
  const [busy, setBusy] = useState(false)

  const openModal = (type, member = null) => {
    setSelectedMember(member)
    setActionModal(type)
    if (member && (type === 'edit')) {
      setForm({ name: member.name, role: member.role, email: member.email, mobile: member.mobile })
    } else {
      setForm({ name: '', role: '', email: '', mobile: '' })
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.role || !form.email || !form.mobile) {
      toast.error('All fields are required')
      return
    }
    setBusy(true)
    try {
      if (actionModal === 'add') {
        await supportMembersApi.create(form)
        toast.success('Support member added')
      } else if (actionModal === 'edit') {
        await supportMembersApi.update(selectedMember._id, form)
        toast.success('Support member updated')
      }
      refetch()
      setActionModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (member) => {
    setBusy(true)
    try {
      await supportMembersApi.toggle(member._id, !member.isActive)
      toast.success(`Support member ${!member.isActive ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setBusy(false)
      setActionModal(null)
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: 'role', header: 'Role' },
    { key: 'email', header: 'Email' },
    { key: 'mobile', header: 'Mobile' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (r) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${r.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{r.isActive ? 'Active' : 'Disabled'}</span>
    },
    {
      key: 'actions',
      header: <div className="text-right">Actions</div>,
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => openModal('edit', r)}>Edit</Button>
          {r.isActive ? (
            <Button size="sm" variant="danger" onClick={() => openModal('toggle', r)}>Deactivate</Button>
          ) : (
            <Button size="sm" variant="success" onClick={() => openModal('toggle', r)}>Activate</Button>
          )}
        </div>
      )
    }
  ]

  const allMembers = data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Members"
        subtitle="Manage support agents available for ticket assignment."
        actions={<Button onClick={() => openModal('add')}>+ Add Support Member</Button>}
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={allMembers} empty="No support members found." />
      )}

      {(actionModal === 'add' || actionModal === 'edit') && (
        <Modal 
          open 
          title={actionModal === 'add' ? 'Add Support Member' : 'Edit Support Member'} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="primary" disabled={busy} onClick={handleSave}>{actionModal === 'add' ? 'Save' : 'Update'}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="Mobile Number" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} />
          </div>
        </Modal>
      )}

      {actionModal === 'toggle' && (
        <Modal 
          open 
          title={selectedMember?.isActive ? 'Deactivate Support Member' : 'Activate Support Member'} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button 
                variant={selectedMember?.isActive ? 'danger' : 'success'} 
                disabled={busy} 
                onClick={() => handleToggle(selectedMember)}
              >
                {selectedMember?.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to {selectedMember?.isActive ? 'deactivate' : 'activate'} this support member?
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
