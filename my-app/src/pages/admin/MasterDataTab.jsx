import { useState, useEffect, useCallback, useMemo } from 'react'
import { masterDataApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Input, Select, Loader, ErrorState, Toggle } from '../../components/ui.jsx'

const CATEGORIES = [
  { id: 'lead-sources', label: 'Lead Sources' },
  { id: 'lead-statuses', label: 'Lead Statuses / Funnel Stages' },
  { id: 'property-types', label: 'Property Types' },
  { id: 'customer-types', label: 'Customer Types' },
  { id: 'booking-sources', label: 'Booking Sources' },
  { id: 'payment-modes', label: 'Payment Modes' },
  { id: 'expense-categories', label: 'Expense Categories' },
  { id: 'marketing-activity-types', label: 'Marketing Activity Types' },
  { id: 'site-visit-statuses', label: 'Site Visit Statuses' },
]

const MOCK_INITIAL_DATA = {
  'lead-sources': [
    { id: 1, name: 'Website', description: 'Direct traffic via corporate website', active: true, usage: 128 },
    { id: 2, name: 'Walk-in', description: 'Physical walk-ins to the office/site', active: true, usage: 45 },
    { id: 3, name: 'Referral', description: 'Client or employee referral', active: true, usage: 12 },
  ],
  'lead-statuses': [
    { id: 1, name: 'New', description: 'Newly assigned, not yet contacted', active: true, usage: 300 },
    { id: 2, name: 'Contacted', description: 'Initial contact made', active: true, usage: 150 },
    { id: 3, name: 'Qualified', description: 'Lead is verified and interested', active: true, usage: 89 },
  ],
  'property-types': [
    { id: 1, name: 'Flat', description: 'Apartment unit', active: true, usage: 890 },
    { id: 2, name: 'Villa', description: 'Standalone house', active: true, usage: 45 },
    { id: 3, name: 'Commercial', description: 'Commercial or retail space', active: true, usage: 10 },
  ],
  'customer-types': [
    { id: 1, name: 'Individual', description: '', active: true, usage: 1200 },
    { id: 2, name: 'Corporate', description: '', active: true, usage: 55 },
  ],
  'booking-sources': [
    { id: 1, name: 'Direct', description: '', active: true, usage: 500 },
    { id: 2, name: 'Channel Partner', description: '', active: true, usage: 300 },
  ],
  'payment-modes': [
    { id: 1, name: 'Bank Transfer', description: 'NEFT/RTGS/IMPS', active: true, usage: 450 },
    { id: 2, name: 'Cheque', description: '', active: true, usage: 200 },
  ],
  'expense-categories': [
    { id: 1, name: 'Marketing', description: 'Ad spend, campaigns', active: true, usage: 120 },
    { id: 2, name: 'Travel', description: 'Site visits and executive travel', active: true, usage: 340 },
  ],
  'marketing-activity-types': [
    { id: 1, name: 'Online Campaign', description: '', active: true, usage: 20 },
    { id: 2, name: 'Offline Promotion', description: '', active: true, usage: 5 },
  ],
  'site-visit-statuses': [
    { id: 1, name: 'Scheduled', description: '', active: true, usage: 50 },
    { id: 2, name: 'Completed', description: '', active: true, usage: 140 },
    { id: 3, name: 'No Show', description: '', active: true, usage: 15 },
  ]
}

function MasterModal({ isOpen, onClose, onSave, editingRecord, categoryData }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        setName(editingRecord.name)
        setDescription(editingRecord.description || '')
        setActive(editingRecord.active)
      } else {
        setName('')
        setDescription('')
        setActive(true)
      }
      setError('')
      setDirty(false)
    }
  }, [isOpen, editingRecord])

  if (!isOpen) return null

  const handleClose = () => {
    if (dirty) {
      if (!window.confirm('Discard changes?\n\nYour changes have not been saved.')) return
    }
    onClose()
  }

  const handleSave = () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    // Duplicate Validation (case/whitespace insensitive)
    const cleanName = name.trim().toLowerCase()
    const isDuplicate = categoryData.some(item => 
      item.id !== editingRecord?.id && 
      item.name.trim().toLowerCase() === cleanName
    )

    if (isDuplicate) {
      setError('This value already exists in this category.')
      return
    }

    onSave({ 
      id: editingRecord?.id, 
      name: name.trim(), 
      description: description.trim(), 
      active 
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">{editingRecord ? 'Edit Master Value' : 'Add New Master Value'}</h3>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4">
          <Input 
            label="Name *" 
            value={name} 
            onChange={e => { setName(e.target.value); setDirty(true); setError('') }} 
            error={error}
            placeholder="e.g. Website"
          />
          <Input 
            label="Description (Optional)" 
            value={description} 
            onChange={e => { setDescription(e.target.value); setDirty(true) }} 
          />
          <div className="pt-2">
            <Toggle 
              checked={active} 
              onChange={val => { setActive(val); setDirty(true) }} 
              label="Active Status" 
            />
            <p className="mt-1 text-xs text-slate-500">
              {active ? 'Available for selection in CRM forms.' : 'Hidden from new selections. Historical records will be retained.'}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ isOpen, title, message, confirmText, onConfirm, onCancel, confirmVariant = 'primary' }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  )
}

export default function MasterDataTab() {
  const toast = useToast()
  
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id)
  const [mockStores, setMockStores] = useState(MOCK_INITIAL_DATA)
  const [isUsingMock, setIsUsingMock] = useState(false)

  // Filtering & Search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false)
  const [recordToDeactivate, setRecordToDeactivate] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(async () => {
    try {
      const res = await masterDataApi.list(activeCategory)
      setIsUsingMock(false)
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        setIsUsingMock(true)
        return { data: { data: mockStores[activeCategory] || [] } }
      }
      throw err
    }
  }, [activeCategory, mockStores]))

  const currentData = isUsingMock ? (mockStores[activeCategory] || []) : (data?.data || [])

  const filteredData = useMemo(() => {
    let result = currentData
    
    if (statusFilter === 'active') result = result.filter(r => r.active)
    if (statusFilter === 'inactive') result = result.filter(r => !r.active)
    
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r => r.name.toLowerCase().includes(q))
    }
    
    return result
  }, [currentData, statusFilter, search])

  const handleOpenAdd = () => {
    setEditingRecord(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (record) => {
    setEditingRecord(record)
    setModalOpen(true)
  }

  const promptDeactivate = (record) => {
    setRecordToDeactivate(record)
    setDeactivateConfirmOpen(true)
  }

  const handleSaveModal = async (recordData) => {
    try {
      if (isUsingMock) {
        setMockStores(prev => {
          const catList = prev[activeCategory] || []
          if (recordData.id) {
            // Update
            return {
              ...prev,
              [activeCategory]: catList.map(r => r.id === recordData.id ? { ...r, ...recordData } : r)
            }
          } else {
            // Create
            const newRecord = { ...recordData, id: Date.now(), usage: 0 }
            return {
              ...prev,
              [activeCategory]: [...catList, newRecord]
            }
          }
        })
      } else {
        if (recordData.id) {
          await masterDataApi.update(activeCategory, recordData.id, recordData)
        } else {
          await masterDataApi.create(activeCategory, recordData)
        }
        refetch()
      }
      toast.success(recordData.id ? 'Master value updated successfully.' : 'Master value added successfully.')
      setModalOpen(false)
    } catch (err) {
      toast.error('Unable to save changes. Please try again.')
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!recordToDeactivate) return
    try {
      if (isUsingMock) {
        setMockStores(prev => {
          const catList = prev[activeCategory] || []
          return {
            ...prev,
            [activeCategory]: catList.map(r => r.id === recordToDeactivate.id ? { ...r, active: false } : r)
          }
        })
      } else {
        await masterDataApi.setStatus(activeCategory, recordToDeactivate.id, false)
        refetch()
      }
      toast.success('Master value deactivated successfully.')
    } catch (err) {
      toast.error('Unable to deactivate. Please try again.')
    } finally {
      setDeactivateConfirmOpen(false)
      setRecordToDeactivate(null)
    }
  }

  const handleQuickActivate = async (record) => {
    try {
      if (isUsingMock) {
        setMockStores(prev => {
          const catList = prev[activeCategory] || []
          return {
            ...prev,
            [activeCategory]: catList.map(r => r.id === record.id ? { ...r, active: true } : r)
          }
        })
      } else {
        await masterDataApi.setStatus(activeCategory, record.id, true)
        refetch()
      }
      toast.success('Master value activated successfully.')
    } catch (err) {
      toast.error('Unable to activate. Please try again.')
    }
  }

  // Reset search when category changes
  useEffect(() => {
    setSearch('')
    setStatusFilter('all')
  }, [activeCategory])

  return (
    <div className="animate-fade-in flex flex-col md:flex-row gap-6">
      
      {/* Left Sidebar for Categories */}
      <div className="w-full md:w-64 shrink-0">
        <div className="md:sticky md:top-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Master Categories</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  activeCategory === cat.id 
                    ? 'bg-blue-50/50 text-blue-700 font-medium border-l-2 border-l-blue-600' 
                    : 'text-slate-600 hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1">
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{CATEGORIES.find(c => c.id === activeCategory)?.label}</h2>
            <p className="text-sm text-slate-500">Manage values used in dropdowns and pipelines.</p>
          </div>
          <Button variant="primary" onClick={handleOpenAdd}>Add New</Button>
        </div>

        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="w-full sm:w-72">
              <Input 
                placeholder={`Search ${CATEGORIES.find(c => c.id === activeCategory)?.label}...`} 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                icon="search"
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center"><Loader /></div>
          ) : error && error.response?.status !== 404 ? (
            <div className="p-12"><ErrorState message="Unable to load master data." onRetry={refetch} /></div>
          ) : filteredData.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-slate-500">No values found in this category.</p>
              {search || statusFilter !== 'all' ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setStatusFilter('all') }}>Clear Filters</Button>
              ) : (
                <Button variant="secondary" size="sm" className="mt-4" onClick={handleOpenAdd}>Add First Value</Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Description</th>
                    <th className="px-6 py-3 font-medium text-center">Status</th>
                    <th className="px-6 py-3 font-medium text-center">Usage</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredData.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{record.name}</td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs truncate" title={record.description}>
                        {record.description || '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ${
                          record.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10'
                        }`}>
                          {record.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        {record.usage !== undefined ? (
                          <span className="bg-slate-100 px-2 py-1 rounded-full text-[11px]">{record.usage}</span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(record)}>Edit</Button>
                          {record.active ? (
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => promptDeactivate(record)}>Deactivate</Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleQuickActivate(record)}>Activate</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <MasterModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSave={handleSaveModal} 
        editingRecord={editingRecord} 
        categoryData={currentData}
      />

      <ConfirmModal 
        isOpen={deactivateConfirmOpen}
        title="Deactivate this value?"
        message="This value will no longer be available for new records. Existing records will retain their historical value."
        confirmText="Deactivate"
        confirmVariant="danger"
        onConfirm={handleConfirmDeactivate}
        onCancel={() => { setDeactivateConfirmOpen(false); setRecordToDeactivate(null) }}
      />
    </div>
  )
}
