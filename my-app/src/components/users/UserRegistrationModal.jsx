import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select } from '../ui.jsx'
import { usersApi, branchesApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'

const ROLE_OPTIONS = [
  { value: 'sales_executive', label: 'Sales Executive', desc: 'Can manage own leads, follow-ups, visits, and bookings' },
  { value: 'sub_admin', label: 'Sub-Admin (Branch Admin)', desc: 'Full operational access over assigned branch and team' },
  { value: 'telecaller', label: 'Telecaller', desc: 'Handles lead qualification, calling queues, and follow-ups' },
  { value: 'admin', label: 'Admin', desc: 'Full firm administrator privileges' },
]

const DEPARTMENTS = [
  'Direct Sales',
  'Channel Partner Sales',
  'Customer Support & CRM',
  'Operations & Compliance',
  'Legal & Documentation',
  'Marketing & Telecalling',
]

const formatInrPreview = (n) => {
  const v = Number(n) || 0
  if (v <= 0) return ''
  if (v >= 1e7) return `≈ ₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `≈ ₹${(v / 1e5).toFixed(2)} Lakhs`
  return `≈ ₹${v.toLocaleString('en-IN')}`
}

export default function UserRegistrationModal({
  open = true,
  user = null,
  branches: initialBranches = null,
  allowedRoles = null,
  defaultRole = 'sales_executive',
  onClose,
  onDone,
}) {
  const toast = useToast()
  const isNew = !user

  // Form State
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: defaultRole,
    branch: '',
    department: 'Direct Sales',
    designation: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    targetRevenue: '',
    targetSales: '',
    dob: '',
    gender: '',
    address: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [branches, setBranches] = useState(initialBranches || [])
  const [activeTab, setActiveTab] = useState('credentials')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Load branches if not passed
  useEffect(() => {
    if (initialBranches && initialBranches.length > 0) {
      setBranches(initialBranches)
    } else {
      branchesApi.list({ limit: 100 })
        .then((res) => {
          const bList = res.data?.data || res.data || []
          setBranches(Array.isArray(bList) ? bList : [])
        })
        .catch(() => setBranches([]))
    }
  }, [initialBranches])

  // Populate when editing an existing user
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        password: '',
        phone: user.phone || '',
        role: user.role || defaultRole,
        branch: user.branch || '',
        department: user.department || 'Direct Sales',
        designation: user.designation || '',
        joiningDate: user.joiningDate ? String(user.joiningDate).slice(0, 10) : '',
        targetRevenue: user.targetRevenue ? String(user.targetRevenue) : '',
        targetSales: user.targetSales ? String(user.targetSales) : '',
        dob: user.dob ? String(user.dob).slice(0, 10) : '',
        gender: user.gender || '',
        address: user.address || '',
        emergencyContactName: user.emergencyContactName || '',
        emergencyContactNumber: user.emergencyContactNumber || '',
      })
    } else {
      setForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: defaultRole,
        branch: initialBranches?.[0]?.name || '',
        department: 'Direct Sales',
        designation: '',
        joiningDate: new Date().toISOString().slice(0, 10),
        targetRevenue: '',
        targetSales: '',
        dob: '',
        gender: '',
        address: '',
        emergencyContactName: '',
        emergencyContactNumber: '',
      })
    }
    setErrorMsg('')
    setActiveTab('credentials')
  }, [user, defaultRole, initialBranches, open])

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errorMsg) setErrorMsg('')
  }

  // Filter roles if restricted
  const availableRoles = allowedRoles
    ? ROLE_OPTIONS.filter((r) => allowedRoles.includes(r.value))
    : ROLE_OPTIONS

  // Validation rules
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isEmailValid = isNew ? emailRegex.test(form.email.trim()) : true
  const isNameValid = form.name.trim().length >= 2
  const isPasswordValid = isNew ? form.password.length >= 8 : (form.password ? form.password.length >= 8 : true)
  const isPhoneValid = !form.phone || /^[0-9+ -]{7,15}$/.test(form.phone.trim())

  const canSubmit = isNameValid && isEmailValid && isPasswordValid && !busy

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!canSubmit) return

    setBusy(true)
    setErrorMsg('')

    try {
      if (isNew) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim() || undefined,
          branch: form.branch || undefined,
          department: form.department || undefined,
          designation: form.designation.trim() || undefined,
          joiningDate: form.joiningDate || undefined,
          targetRevenue: form.targetRevenue ? Number(form.targetRevenue) : 0,
          targetSales: form.targetSales ? Number(form.targetSales) : 0,
          dob: form.dob || undefined,
          gender: form.gender || undefined,
          address: form.address.trim() || undefined,
          emergencyContactName: form.emergencyContactName.trim() || undefined,
          emergencyContactNumber: form.emergencyContactNumber.trim() || undefined,
        }
        const res = await usersApi.create(payload)
        toast.success(`User ${form.name} registered successfully!`)
        onDone?.(res.data?.data || res.data)
      } else {
        const payload = {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          branch: form.branch || undefined,
          department: form.department || undefined,
          designation: form.designation.trim() || undefined,
          joiningDate: form.joiningDate || undefined,
          targetRevenue: form.targetRevenue ? Number(form.targetRevenue) : 0,
          targetSales: form.targetSales ? Number(form.targetSales) : 0,
          dob: form.dob || undefined,
          gender: form.gender || undefined,
          address: form.address.trim() || undefined,
          emergencyContactName: form.emergencyContactName.trim() || undefined,
          emergencyContactNumber: form.emergencyContactNumber.trim() || undefined,
        }
        if (form.password && form.password.length >= 8) {
          payload.password = form.password
        }
        const res = await usersApi.update(user._id || user.id, payload)
        toast.success(`User ${form.name} profile updated successfully!`)
        onDone?.(res.data?.data || res.data)
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Operation failed'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide={true}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <span className="material-symbols-outlined text-[24px]">
              {isNew ? 'person_add' : 'manage_accounts'}
            </span>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              {isNew ? 'User Registration' : `Update User: ${user.name}`}
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              {isNew
                ? 'Create user credentials, assign role, branch, and sales targets'
                : `Editing profile & permissions for ${user.email}`}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-slate-400">
            <span className="text-rose-500">*</span> Required fields
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!canSubmit || busy}
              className="min-w-[130px]"
            >
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>{isNew ? 'Registering…' : 'Saving…'}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">
                    {isNew ? 'how_to_reg' : 'save'}
                  </span>
                  <span>{isNew ? 'Register User' : 'Update User'}</span>
                </span>
              )}
            </Button>
          </div>
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div className="mb-5 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'credentials'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">badge</span>
          <span>1. Credentials & Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('organization')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'organization'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">corporate_fare</span>
          <span>2. Role & Organization</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'targets'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">trending_up</span>
          <span>3. Targets & Personal</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <span className="material-symbols-outlined shrink-0 text-[18px] text-rose-600">error</span>
          <div>
            <p className="font-semibold">Unable to process user registration</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* TAB 1: Credentials & Identity */}
      {activeTab === 'credentials' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
              {!isNameValid && form.name && (
                <p className="mt-1 text-[11px] text-rose-500">Name must be at least 2 characters</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
              {!isPhoneValid && (
                <p className="mt-1 text-[11px] text-rose-500">Please enter a valid phone number</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email Address {isNew && <span className="text-rose-500">*</span>}
              </label>
              <Input
                type="email"
                placeholder="e.g. rahul@company.com"
                value={form.email}
                disabled={!isNew}
                onChange={(e) => setField('email', e.target.value)}
              />
              {isNew && !isEmailValid && form.email && (
                <p className="mt-1 text-[11px] text-rose-500">Enter a valid email address</p>
              )}
              {!isNew && (
                <p className="mt-1 text-[11px] text-slate-400">Email cannot be changed after registration</p>
              )}
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>
                  {isNew ? 'Initial Password' : 'Reset Password (Optional)'}{' '}
                  {isNew && <span className="text-rose-500">*</span>}
                </span>
                {form.password && (
                  <span className={`text-[10px] font-medium ${form.password.length >= 8 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {form.password.length >= 8 ? '✓ Length OK' : `${form.password.length}/8 chars`}
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isNew ? 'Min. 8 characters' : 'Leave blank to keep unchanged'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {isNew && form.password && form.password.length < 8 && (
                <p className="mt-1 text-[11px] text-rose-500">Password must be at least 8 characters</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-blue-50 bg-blue-50/50 p-3 text-xs text-blue-800">
            <div className="flex items-center gap-1.5 font-semibold">
              <span className="material-symbols-outlined text-[16px]">security</span>
              <span>Account Credentials</span>
            </div>
            <p className="mt-0.5 text-blue-700">
              {isNew
                ? 'The registered user can log in to the system using this Email and Password immediately.'
                : 'Enter a new password only if the employee requested a password reset.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: Role & Organization */}
      {activeTab === 'organization' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              System Role Assignment <span className="text-rose-500">*</span>
            </label>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {availableRoles.map((r) => {
                const isSelected = form.role === r.value
                return (
                  <div
                    key={r.value}
                    onClick={() => setField('role', r.value)}
                    className={`flex cursor-pointer flex-col rounded-lg border p-3 transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{r.label}</span>
                      <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-blue-600' : 'text-slate-300'}`}>
                        {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{r.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Assigned Branch <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.branch}
                onChange={(e) => setField('branch', e.target.value)}
              >
                <option value="">Unassigned / All Branches</option>
                {branches.map((b) => (
                  <option key={b._id || b.name} value={b.name}>
                    {b.name} {b.city ? `(${b.city})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Department <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Job Designation
              </label>
              <Input
                placeholder="e.g. Senior Property Advisor"
                value={form.designation}
                onChange={(e) => setField('designation', e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Date of Joining
              </label>
              <Input
                type="date"
                value={form.joiningDate}
                onChange={(e) => setField('joiningDate', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Targets & Personal Details */}
      {activeTab === 'targets' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span className="material-symbols-outlined text-[16px] text-blue-600">flag</span>
              <span>Sales Performance Targets</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Revenue Target (₹)</span>
                  {form.targetRevenue && (
                    <span className="text-[11px] font-bold text-emerald-600">
                      {formatInrPreview(form.targetRevenue)}
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 5000000"
                  value={form.targetRevenue}
                  onChange={(e) => setField('targetRevenue', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Target Units Closed
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={form.targetSales}
                  onChange={(e) => setField('targetSales', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span className="material-symbols-outlined text-[16px] text-slate-500">contact_phone</span>
              <span>Personal & Emergency Info</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Date of Birth
                </label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setField('dob', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Gender
                </label>
                <Select
                  value={form.gender}
                  onChange={(e) => setField('gender', e.target.value)}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Emergency Phone
                </label>
                <Input
                  placeholder="e.g. 9811223344"
                  value={form.emergencyContactNumber}
                  onChange={(e) => setField('emergencyContactNumber', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Residential Address
              </label>
              <Input
                placeholder="Street address, city, pin code"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

