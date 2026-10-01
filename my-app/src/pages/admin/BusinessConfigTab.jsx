import { useState, useEffect, useCallback } from 'react'
import { companyBusinessConfigApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Loader, ErrorState, Toggle } from '../../components/ui.jsx'

const DEFAULT_CONFIG = {
  lead: {
    duplicateDetection: true,
    followUpReminder: true,
    leadConversion: true,
    autoLeadAssignment: false,
    leadAssignmentMethod: 'manual',
  },
  sales: {
    discountCapPercent: 2,
    inventoryLockHours: 48,
    allowBookingFromInventory: true,
  },
  rental: {
    enableRentalModule: false,
    requireCustomerBeforeVisit: true,
    requireCustomerBeforeBooking: true,
  },
  booking: {
    bookingValidityDays: 7,
    autoCancelUnconfirmed: false,
    requireCustomerBeforeBooking: true, 
  },
  payment: {
    paymentReceiptRequired: true,
  },
  commission: {
    office: 60,
    executive: 25,
    branch: 15,
    commissionTracking: true,
  },
  expense: {
    expenseReceiptRequired: true,
  },
  branch: {
    branchBasedDataAccess: true,
    employeeTransferTracking: true,
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    halfDayThresholdHours: 4,
  }
}

function SettingsSection({ title, children }) {
  return (
    <Card className="mt-6 p-0 overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </Card>
  )
}

function ConfigRow({ title, description, checked, onChange, editing }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
      <div className="pr-8">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">{description}</p>
      </div>
      <div className="shrink-0">
        {editing ? (
          <Toggle 
            checked={checked} 
            onChange={onChange} 
            hideLabel 
            label={title} 
          />
        ) : (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
            checked ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
          }`}>
            {checked ? 'ON' : 'OFF'}
          </span>
        )}
      </div>
    </div>
  )
}

function InputRow({ title, description, value, onChange, editing, type = "text", error, suffix, disabled, inputWidth = "w-24" }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
      <div className="pr-8">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">{description}</p>
        {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <input 
              type={type} 
              value={value} 
              onChange={onChange} 
              disabled={disabled}
              className={`block ${inputWidth} rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:leading-6 ${
                error 
                  ? 'ring-red-300 focus:ring-red-500 text-red-900' 
                  : 'ring-slate-300 focus:ring-blue-600'
              } ${disabled ? 'bg-slate-50 text-slate-500' : ''}`}
            />
            {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
          </div>
        ) : (
          <span className="text-sm font-medium text-slate-900">
            {value} {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function SelectRow({ title, description, value, onChange, options, editing, disabled }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
      <div className="pr-8">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">{description}</p>
      </div>
      <div className="shrink-0">
        {editing ? (
          <select 
            value={value} 
            onChange={onChange}
            disabled={disabled}
            className={`block w-40 rounded-md border-0 py-1.5 pl-3 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:leading-6 ${
              disabled ? 'bg-slate-50 text-slate-500 ring-slate-200' : 'ring-slate-300 focus:ring-blue-600'
            }`}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium text-slate-900">
            {options.find(o => o.value === value)?.label || value}
          </span>
        )}
      </div>
    </div>
  )
}

export default function BusinessConfigTab() {
  const toast = useToast()

  const { data, loading, error, refetch } = useFetch(useCallback(async () => {
    try {
      const res = await companyBusinessConfigApi.get()
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        return { data: { data: DEFAULT_CONFIG } }
      }
      throw err
    }
  }, []))

  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setForm(data.data || DEFAULT_CONFIG)
  }, [data])

  const setNested = (group, key, value) => {
    setForm(f => ({
      ...f,
      [group]: { ...f[group], [key]: value }
    }))
  }

  const handleCancel = () => {
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(data?.data || DEFAULT_CONFIG)
    if (hasUnsavedChanges) {
      if (!window.confirm('Your changes have not been saved. Do you want to discard them?')) {
        return
      }
    }
    setForm(data?.data || DEFAULT_CONFIG)
    setEditing(false)
  }

  const splitTotal = form ? Number(form.commission.office) + Number(form.commission.executive) + Number(form.commission.branch) : 0
  const splitError = splitTotal !== 100 ? 'Commission split must total 100%.' : null

  const handleSave = async () => {
    if (splitTotal !== 100) {
      toast.error('Commission split must total 100%')
      return
    }
    
    setBusy(true)
    try {
      try {
        await companyBusinessConfigApi.update(form)
      } catch (err) {
        if (err.response?.status !== 404) throw err
      }
      toast.success('Business configuration updated successfully.')
      refetch() 
      setEditing(false)
    } catch (err) {
      toast.error('Unable to update business configuration. No changes were saved.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !form) return <div className="mt-6"><Loader /></div>
  if (error && error.response?.status !== 404) return <div className="mt-6"><ErrorState message="Unable to load business configuration." onRetry={refetch} /></div>

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500 max-w-xl">Configure company-level rules used across sales, rental, booking, payment, commission, expense, lead, and branch operations.</p>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="secondary" size="sm">Edit Configuration</Button>
        ) : (
          <div className="flex gap-2 shrink-0">
            <Button onClick={handleCancel} variant="ghost" size="sm" disabled={busy}>Cancel</Button>
            <Button onClick={handleSave} variant="primary" size="sm" loading={busy} disabled={!!splitError}>Save Changes</Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* 1. Lead Configuration */}
        <SettingsSection title="Lead Configuration">
          <ConfigRow 
            title="Duplicate Lead Detection" 
            description="Identify potential duplicate leads when a new lead is created." 
            checked={form.lead.duplicateDetection} 
            onChange={(v) => setNested('lead', 'duplicateDetection', v)} 
            editing={editing} 
          />
          <ConfigRow 
            title="Follow-up Reminder" 
            description="Enable reminders for scheduled and overdue lead follow-ups." 
            checked={form.lead.followUpReminder} 
            onChange={(v) => setNested('lead', 'followUpReminder', v)} 
            editing={editing} 
          />
          <ConfigRow 
            title="Lead Conversion" 
            description="Allow qualified leads to be converted into customers through the existing CRM flow." 
            checked={form.lead.leadConversion} 
            onChange={(v) => setNested('lead', 'leadConversion', v)} 
            editing={editing} 
          />
          <ConfigRow 
            title="Auto Lead Assignment" 
            description="Automatically assign new leads using the selected distribution method." 
            checked={form.lead.autoLeadAssignment} 
            onChange={(v) => setNested('lead', 'autoLeadAssignment', v)} 
            editing={editing} 
          />
          <SelectRow 
            title="Assignment Method" 
            description="Method used for automatically distributing leads to available agents." 
            value={form.lead.leadAssignmentMethod} 
            onChange={(e) => setNested('lead', 'leadAssignmentMethod', e.target.value)} 
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'round_robin', label: 'Round Robin' }
            ]}
            editing={editing} 
            disabled={!form.lead.autoLeadAssignment}
          />
        </SettingsSection>

        {/* 2. Sales & Inventory */}
        <SettingsSection title="Sales & Inventory">
          <InputRow 
            title="Standard Discount Cap" 
            description="Default maximum discount percentage allowed during discount recording." 
            type="number"
            value={form.sales.discountCapPercent} 
            onChange={(e) => setNested('sales', 'discountCapPercent', e.target.value)} 
            editing={editing} 
            suffix="%"
          />
          <InputRow 
            title="Inventory Lock Window" 
            description="Duration for which inventory remains locked according to the existing booking workflow." 
            type="number"
            value={form.sales.inventoryLockHours} 
            onChange={(e) => setNested('sales', 'inventoryLockHours', e.target.value)} 
            editing={editing} 
            suffix="Hours"
          />
          <ConfigRow 
            title="Allow Booking From Sales Inventory" 
            description="Allow available sales inventory to be directly selected during booking." 
            checked={form.sales.allowBookingFromInventory} 
            onChange={(v) => setNested('sales', 'allowBookingFromInventory', v)} 
            editing={editing} 
          />
        </SettingsSection>

        {/* 3. Rental Configuration */}
        <SettingsSection title="Rental Configuration">
          <ConfigRow 
            title="Enable Rental Module" 
            description="Enable rental operations and transactions for this company." 
            checked={form.rental.enableRentalModule} 
            onChange={(v) => setNested('rental', 'enableRentalModule', v)} 
            editing={editing} 
          />
          {form.rental.enableRentalModule && (
            <>
              <ConfigRow 
                title="Require Customer Before Rental Site Visit" 
                description="Require a customer record before scheduling a rental property visit." 
                checked={form.rental.requireCustomerBeforeVisit} 
                onChange={(v) => setNested('rental', 'requireCustomerBeforeVisit', v)} 
                editing={editing} 
              />
              <ConfigRow 
                title="Require Customer Before Rental Transaction" 
                description="Require a customer record before finalizing a rental booking." 
                checked={form.rental.requireCustomerBeforeBooking} 
                onChange={(v) => setNested('rental', 'requireCustomerBeforeBooking', v)} 
                editing={editing} 
              />
            </>
          )}
        </SettingsSection>

        {/* 4. Booking Configuration */}
        <SettingsSection title="Booking Configuration">
          <InputRow 
            title="Booking Validity" 
            description="How long a booking remains valid before automatically expiring." 
            type="number"
            value={form.booking.bookingValidityDays} 
            onChange={(e) => setNested('booking', 'bookingValidityDays', e.target.value)} 
            editing={editing} 
            suffix="Days"
          />
          <ConfigRow 
            title="Auto-Cancel Unconfirmed Booking" 
            description="Automatically cancel bookings that remain unconfirmed past validity." 
            checked={form.booking.autoCancelUnconfirmed} 
            onChange={(v) => setNested('booking', 'autoCancelUnconfirmed', v)} 
            editing={editing} 
          />
          <ConfigRow 
            title="Require Customer Before Booking" 
            description="Require the property buyer to be a registered customer before creating a booking." 
            checked={form.booking.requireCustomerBeforeBooking} 
            onChange={(v) => setNested('booking', 'requireCustomerBeforeBooking', v)} 
            editing={editing} 
          />
        </SettingsSection>

        {/* 5. Payment Configuration */}
        <SettingsSection title="Payment Configuration">
          <ConfigRow 
            title="Payment Receipt Required" 
            description="Require a receipt or supporting payment document when recording a company payment." 
            checked={form.payment.paymentReceiptRequired} 
            onChange={(v) => setNested('payment', 'paymentReceiptRequired', v)} 
            editing={editing} 
          />
        </SettingsSection>

        {/* 6. Commission Configuration */}
        <SettingsSection title="Commission Configuration">
          <ConfigRow 
            title="Commission Tracking" 
            description="Enable basic commission tracking for applicable sales transactions." 
            checked={form.commission.commissionTracking} 
            onChange={(v) => setNested('commission', 'commissionTracking', v)} 
            editing={editing} 
          />
          <div className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="pr-8">
                <p className="text-sm font-medium text-slate-900">Commission Payout Split</p>
                <p className="mt-0.5 text-xs text-slate-500 max-w-2xl">Default distribution percentages for recorded commissions.</p>
                {splitError && editing && <p className="mt-1 text-xs font-medium text-red-600">{splitError}</p>}
                {!editing && <p className="mt-1 text-xs font-medium text-slate-500">Total: {splitTotal}%</p>}
              </div>
            </div>
            
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-xl">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Office</label>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.commission.office} onChange={(e) => setNested('commission', 'office', e.target.value)} className="block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-900 font-medium">{form.commission.office} %</span>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Executive</label>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.commission.executive} onChange={(e) => setNested('commission', 'executive', e.target.value)} className="block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-900 font-medium">{form.commission.executive} %</span>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Branch</label>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.commission.branch} onChange={(e) => setNested('commission', 'branch', e.target.value)} className="block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:leading-6" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-900 font-medium">{form.commission.branch} %</span>
                )}
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* 7. Expense Configuration */}
        <SettingsSection title="Expense Configuration">
          <ConfigRow 
            title="Expense Receipt Required" 
            description="Require supporting documentation when recording an expense." 
            checked={form.expense.expenseReceiptRequired} 
            onChange={(v) => setNested('expense', 'expenseReceiptRequired', v)} 
            editing={editing} 
          />
        </SettingsSection>

        {/* 8. Branch & Employee Operations */}
        <SettingsSection title="Branch & Employee Operations">
          <ConfigRow 
            title="Branch-Based Data Access" 
            description="Restrict operational data according to the user's assigned branch and permissions." 
            checked={form.branch.branchBasedDataAccess} 
            onChange={(v) => setNested('branch', 'branchBasedDataAccess', v)} 
            editing={editing} 
          />
          <ConfigRow 
            title="Employee Transfer Tracking" 
            description="Maintain history when employees are transferred between branches." 
            checked={form.branch.employeeTransferTracking} 
            onChange={(v) => setNested('branch', 'employeeTransferTracking', v)} 
            editing={editing} 
          />
          <InputRow 
            title="Office Start Time" 
            description="Default expected check-in time for branch employees." 
            type="time"
            inputWidth="w-32"
            value={form.branch.officeStartTime} 
            onChange={(e) => setNested('branch', 'officeStartTime', e.target.value)} 
            editing={editing} 
          />
          <InputRow 
            title="Office End Time" 
            description="Default expected check-out time for branch employees." 
            type="time"
            inputWidth="w-32"
            value={form.branch.officeEndTime} 
            onChange={(e) => setNested('branch', 'officeEndTime', e.target.value)} 
            editing={editing} 
          />
          <InputRow 
            title="Half-Day Threshold" 
            description="Minimum working hours required to mark an employee as present for a half-day." 
            type="number"
            value={form.branch.halfDayThresholdHours} 
            onChange={(e) => setNested('branch', 'halfDayThresholdHours', e.target.value)} 
            editing={editing} 
            suffix="Hours"
          />
        </SettingsSection>
      </div>
    </div>
  )
}
