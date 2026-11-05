import { useState, useCallback } from 'react'
import { Card, Button, Input, Select, DropdownSelect, useBodyScrollLock } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ticketsApi, ticketCategoriesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

// Live "Create Support Ticket" modal. Persists via POST /api/tickets. The firm is
// derived server-side from the caller (Super Admin excepted). Category options are
// loaded live from the ticket-category catalog.
export default function CreateTicketModal({ onClose, onDone }) {
  useBodyScrollLock(true)
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ category: '', priority: 'Medium', subject: '', description: '' })

  const cats = useFetch(useCallback(() => ticketCategoriesApi.list(), []))
  const categories = (cats.data || []).filter((c) => c.isActive !== false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const categoryOptions = [
    { value: '', label: cats.loading ? 'Loading categories…' : 'Select Category' },
    ...categories.map((c) => ({ value: c._id, label: c.name })),
  ]
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: p }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category || !form.subject.trim() || !form.description.trim()) {
      toast.error('Category, subject and description are required.')
      return
    }
    setLoading(true)
    try {
      await ticketsApi.create({
        category: form.category,
        priority: form.priority,
        subject: form.subject.trim(),
        description: form.description.trim(),
      })
      toast.success('Support ticket created')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onClose === 'function') onClose()
      }}
    >
      <Card
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-xl overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Create Support Ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 overscroll-contain thin-scroll">
          <form id="create-ticket-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h4 className="border-b pb-2 text-sm font-semibold text-slate-800">Classification</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <DropdownSelect
                  label="Category *"
                  value={form.category}
                  onChange={set('category')}
                  options={categoryOptions}
                  placeholder="Select Category"
                  required
                />
                <DropdownSelect
                  label="Priority *"
                  value={form.priority}
                  onChange={set('priority')}
                  options={priorityOptions}
                  placeholder="Select Priority"
                  required
                />
              </div>
              {!cats.loading && categories.length === 0 && (
                <p className="text-xs text-amber-600">No ticket categories exist yet. Ask a Super Admin to create categories first.</p>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="border-b pb-2 text-sm font-semibold text-slate-800">Details</h4>
              <Input label="Subject *" value={form.subject} onChange={set('subject')} placeholder="Brief description of the issue" maxLength={150} required />
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description *</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none transition duration-150 hover:border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15"
                  rows={4} value={form.description} onChange={set('description')} placeholder="Provide a detailed explanation…" required
                />
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" form="create-ticket-form" loading={loading}>Create Ticket</Button>
        </div>
      </Card>
    </div>
  )
}
