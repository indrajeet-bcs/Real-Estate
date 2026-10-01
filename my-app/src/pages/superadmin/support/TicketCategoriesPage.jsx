import { useState, useCallback } from 'react'
import { ticketCategoriesApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { useToast } from '../../../context/ToastContext.jsx'
import { formatDate } from '../../../lib/format.js'
import { PageHeader, Button, Input, Loader, ErrorState, Modal, Table } from '../../../components/ui.jsx'

export default function TicketCategoriesPage() {
  const toast = useToast()
  
  const { data, loading, error, refetch } = useFetch(useCallback(() => ticketCategoriesApi.list(), []))
  
  const [actionModal, setActionModal] = useState(null)
  const [selectedCat, setSelectedCat] = useState(null)
  const [formName, setFormName] = useState('')
  const [busy, setBusy] = useState(false)

  const openModal = (type, cat = null) => {
    setSelectedCat(cat)
    setActionModal(type)
    setFormName(cat ? cat.name : '')
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setBusy(true)
    try {
      if (actionModal === 'add') {
        await ticketCategoriesApi.create({ name: formName })
        toast.success('Category added')
      } else if (actionModal === 'edit') {
        await ticketCategoriesApi.update(selectedCat._id, { name: formName })
        toast.success('Category updated')
      }
      refetch()
      setActionModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (cat) => {
    try {
      await ticketCategoriesApi.toggle(cat._id, !cat.isActive)
      toast.success(cat.isActive ? 'Category deactivated' : 'Category activated')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    }
  }

  const handleDelete = async (cat) => {
    try {
      await ticketCategoriesApi.remove(cat._id)
      toast.success('Category deleted')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete category')
    }
  }

  const columns = [
    { key: 'name', header: 'Category Name' },
    { 
      key: 'isActive', 
      header: 'Status', 
      render: (r) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${r.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>
    },
    { key: 'createdAt', header: 'Created On', render: (r) => <span className="text-slate-500 text-xs">{formatDate(r.createdAt)}</span> },
    {
      key: 'actions',
      header: <div className="text-right">Actions</div>,
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleToggle(r)}>{r.isActive ? 'Deactivate' : 'Activate'}</Button>
          <Button size="sm" variant="secondary" onClick={() => openModal('edit', r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(r)}>Delete</Button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket Categories"
        subtitle="Manage the categories available for support tickets."
        actions={<Button onClick={() => openModal('add')}>+ Add Category</Button>}
      />

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={data || []} empty="No categories found." />
      )}

      {(actionModal === 'add' || actionModal === 'edit') && (
        <Modal 
          open 
          title={actionModal === 'add' ? 'Add Category' : 'Edit Category'} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="primary" disabled={busy || !formName.trim()} onClick={handleSave}>{actionModal === 'add' ? 'Add' : 'Save'}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input 
              label="Category Name" 
              value={formName} 
              onChange={e => setFormName(e.target.value)} 
              placeholder="e.g. Technical Issue"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
