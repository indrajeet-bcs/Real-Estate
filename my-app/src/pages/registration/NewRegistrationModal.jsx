import { useState, useEffect, useCallback } from 'react'
import { Modal, Button, Input, Select, Textarea, Loader } from '../../components/ui.jsx'
import { REGISTRATION_TYPES } from '../../lib/registrationConstants.js'
import { registrationsApi, bookingsApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useFetch } from '../../hooks/useFetch.js'

export default function NewRegistrationModal({ open, onClose, onDone }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState('')

  // Fetch available bookings to allow 1-click auto-fill
  const { data: bookingsData, loading: loadingBookings } = useFetch(
    useCallback(() => bookingsApi.list({ limit: 100 }), [])
  )
  const bookings = bookingsData || []

  const [form, setForm] = useState({
    booking: null,
    bookingLabel: '',
    customer: null,
    customerName: '',
    project: '',
    unitNumber: '',
    branch: '',
    registrationType: REGISTRATION_TYPES[0] || 'Sale Deed Registration',
    registrationAuthority: '',
    assignedEmployeeName: '',
    expectedRegistrationDate: '',
    remarks: '',
  })

  // Auto-fill when a booking is selected
  const handleBookingSelect = (e) => {
    const bId = e.target.value
    setSelectedBookingId(bId)
    if (!bId) return

    const b = bookings.find((x) => String(x._id) === bId)
    if (b) {
      setForm((f) => ({
        ...f,
        booking: b._id,
        bookingLabel: b.bookingId || b.code || `BK-${String(b._id).slice(-4).toUpperCase()}`,
        customer: b.customer?._id || b.customer || null,
        customerName: b.customer?.name || f.customerName,
        project: b.project?.name || b.projectName || f.project,
        unitNumber: b.unit?.unitNumber || b.unitNumber || f.unitNumber,
        branch: b.branch?.name || b.branch || f.branch,
      }))
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.customerName.trim()) {
      toast.error('Customer name is required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        booking: form.booking || undefined,
        bookingLabel: form.bookingLabel || undefined,
        customer: form.customer || undefined,
        customerName: form.customerName.trim(),
        project: form.project || undefined,
        unitNumber: form.unitNumber || undefined,
        branch: form.branch || undefined,
        registrationType: form.registrationType,
        registrationAuthority: form.registrationAuthority || undefined,
        assignedEmployeeName: form.assignedEmployeeName || undefined,
        expectedRegistrationDate: form.expectedRegistrationDate || undefined,
        status: 'Pending',
        remarks: form.remarks || undefined,
      }

      const res = await registrationsApi.create(payload)
      toast.success('Registration case created successfully')
      if (onDone) onDone(res.data?.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create registration case')
    } finally {
      setSaving(false)
    }
  }

  // Today's date string for min attribute
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide={true}
      title="New Registration Case"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-registration-form"
            loading={saving}
            disabled={saving || !form.customerName.trim()}
          >
            Create Registration Case
          </Button>
        </>
      }
    >
      <form id="new-registration-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Quick-fill Helper */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-blue-900">
            Quick Auto-Fill from Customer Booking (Optional)
          </label>
          <p className="mb-2 text-xs text-blue-700">
            Select an existing customer booking to automatically fill property and customer details.
          </p>
          <select
            value={selectedBookingId}
            onChange={handleBookingSelect}
            disabled={loadingBookings}
            className="w-full rounded-lg border border-blue-200 bg-white py-2 px-3 text-sm text-slate-800 shadow-sm transition hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
          >
            <option value="">-- Choose a booking or enter manually below --</option>
            {bookings.map((b) => {
              const label = b.bookingId || b.code || `BK-${String(b._id).slice(-4).toUpperCase()}`
              const cust = b.customer?.name || 'Customer'
              const proj = b.project?.name || ''
              return (
                <option key={b._id} value={b._id}>
                  {label} — {cust} {proj ? `(${proj})` : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Section 1: Customer & Property Info */}
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Customer & Property Details
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Customer Name *"
                placeholder="Full customer name"
                value={form.customerName}
                onChange={set('customerName')}
                required
              />
            </div>
            <div>
              <Input
                label="Booking ID / Reference"
                placeholder="e.g. BK-2026-0042"
                value={form.bookingLabel}
                onChange={set('bookingLabel')}
              />
            </div>
            <div>
              <Input
                label="Project Name"
                placeholder="e.g. Skyline Heights"
                value={form.project}
                onChange={set('project')}
              />
            </div>
            <div>
              <Input
                label="Unit / Flat Number"
                placeholder="e.g. A-402"
                value={form.unitNumber}
                onChange={set('unitNumber')}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Branch"
                placeholder="e.g. Mumbai Main Branch"
                value={form.branch}
                onChange={set('branch')}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Registration Authority & Schedule */}
        <div className="border-t border-slate-100 pt-5">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Registration Details
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Select
                label="Registration Type *"
                value={form.registrationType}
                onChange={set('registrationType')}
              >
                {REGISTRATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Input
                label="Sub-Registrar Office / Authority"
                placeholder="e.g. Sub-Registrar Office, Bandra"
                value={form.registrationAuthority}
                onChange={set('registrationAuthority')}
              />
            </div>
            <div>
              <Input
                label="Expected Registration Date"
                type="date"
                min={todayStr}
                value={form.expectedRegistrationDate}
                onChange={set('expectedRegistrationDate')}
              />
            </div>
            <div>
              <Input
                label="Assigned Executive / Representative"
                placeholder="Officer handling registration"
                value={form.assignedEmployeeName}
                onChange={set('assignedEmployeeName')}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Remarks */}
        <div className="border-t border-slate-100 pt-5">
          <Textarea
            label="Remarks / Special Instructions"
            placeholder="Add any notes on stamp duty, legal clearances, or customer instructions..."
            rows={3}
            value={form.remarks}
            onChange={set('remarks')}
          />
        </div>
      </form>
    </Modal>
  )
}

