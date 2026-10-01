import { useState, useCallback } from 'react'
import { expensesApi, projectsApi, branchesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { titleCase } from '../../lib/format.js'
import { Modal, Button, Input, Textarea, Select } from '../../components/ui.jsx'
import { PAYMENT_METHODS, DEPARTMENTS, RECEIPT_ACCEPT } from '../../lib/expenses.js'

// Add Expense (§Add Expense). Created By is the current user (auto). Leaving the
// form as Draft keeps it out of totals until submitted.
export default function AddExpenseModal({ expense, onClose, onDone }) {
  const { can, user } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(expense?._id)
  const isManager = can('user', 'view') // admin / sub-admin pick branch freely
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    title: expense?.title || '', category: expense?.category?._id || expense?.category || '',
    expenseDate: expense?.expenseDate ? expense.expenseDate.slice(0, 10) : today,
    branch: expense?.branch || user.branch || '', department: expense?.department || '',
    project: expense?.project?._id || expense?.project || '', amount: expense?.amount || '',
    paymentMethod: expense?.paymentMethod || 'cash', paidTo: expense?.paidTo || '',
    referenceNumber: expense?.referenceNumber || '', description: expense?.description || '',
    status: 'submitted',
  })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data: categories } = useFetch(useCallback(() => expensesApi.categories(), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: branches } = useFetch(useCallback(() => (isManager ? branchesApi.list() : Promise.resolve({ data: { data: [] } })), [isManager]))
  // Departments = the app-wide list (standard set + those actually used by employees).
  const { data: config } = useFetch(useCallback(() => expensesApi.config(), []))
  const departments = config?.departments?.length ? config.departments : DEPARTMENTS
  const activeCats = (categories || []).filter((c) => c.active !== false)

  const valid = form.title.trim().length >= 2 && form.category && Number(form.amount) > 0 && form.expenseDate

  async function submit(asDraft) {
    if (!valid) { toast.error('Title, category, amount and date are required'); return }
    if (form.expenseDate > today) { toast.error('Expense date cannot be in the future'); return }
    setBusy(true)
    try {
      const payload = {
        title: form.title, category: form.category, expenseDate: form.expenseDate,
        branch: form.branch || undefined, department: form.department || undefined, project: form.project || undefined,
        amount: Number(form.amount), paymentMethod: form.paymentMethod, paidTo: form.paidTo || undefined,
        referenceNumber: form.referenceNumber || undefined, description: form.description || undefined,
      }
      let id
      if (isEdit) { await expensesApi.update(expense._id, payload); id = expense._id }
      else { const res = await expensesApi.create({ ...payload, status: asDraft ? 'draft' : 'submitted' }); id = res.data.data._id }
      if (file) { const fd = new FormData(); fd.append('file', file); fd.append('label', file.name); try { await expensesApi.uploadReceipt(id, fd) } catch { /* non-fatal */ } }
      toast.success(isEdit ? 'Expense updated' : asDraft ? 'Saved as draft' : 'Expense recorded')
      onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save expense') }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isEdit ? `Edit ${expense.expenseCode}` : 'Add Expense'} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {!isEdit && <Button variant="secondary" onClick={() => submit(true)} disabled={busy || !valid}>Save as Draft</Button>}
        <Button onClick={() => submit(false)} disabled={busy || !valid}>{isEdit ? 'Save Changes' : 'Save Expense'}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Expense Title *" value={form.title} onChange={set('title')} placeholder="e.g. Office electricity — March" /></div>
        <Select label="Category *" value={form.category} onChange={set('category')}>
          <option value="">Select category…</option>
          {activeCats.map((c) => <option key={c._id} value={c._id}>{c.name}{c.group === 'marketing' ? ' · Marketing' : ''}</option>)}
        </Select>
        <Input label="Expense Date *" type="date" max={today} value={form.expenseDate} onChange={set('expenseDate')} />
        <Input label="Amount (₹) *" type="number" min="1" value={form.amount} onChange={set('amount')} />
        <Select label="Payment Method *" value={form.paymentMethod} onChange={set('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select>
        {isManager
          ? <Select label="Branch" value={form.branch} onChange={set('branch')}><option value="">— None —</option>{(branches || []).map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}</Select>
          : <Input label="Branch" value={form.branch} onChange={set('branch')} />}
        <Select label="Department" value={form.department} onChange={set('department')}><option value="">— None —</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
        <Select label="Project (optional)" value={form.project} onChange={set('project')}><option value="">None</option>{(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
        <Input label="Paid To (optional)" value={form.paidTo} onChange={set('paidTo')} placeholder="Vendor / payee" />
        <Input label="Reference Number (optional)" value={form.referenceNumber} onChange={set('referenceNumber')} />
        <div className="sm:col-span-2"><Textarea label="Description" value={form.description} onChange={set('description')} /></div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Receipt (optional)</span>
          <input type="file" accept={RECEIPT_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-600" />
          <p className="mt-1 text-xs text-slate-400">PDF, JPG or PNG up to 10MB.</p>
        </div>
      </div>
    </Modal>
  )
}
