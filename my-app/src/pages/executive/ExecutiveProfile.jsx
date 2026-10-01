import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { authApi } from '../../api/auth.api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Select, Modal, Loader } from '../../components/ui.jsx'

const DOC_TYPES = [
  ['id_proof', 'ID Proof'], ['address_proof', 'Address Proof'], ['pan', 'PAN Card'],
  ['aadhaar', 'Aadhaar Card'], ['driving_license', 'Driving License'], ['other', 'Other Documents'],
]

function browserOf(ua = '') {
  if (/edg/i.test(ua)) return 'Microsoft Edge'
  if (/chrome|crios/i.test(ua)) return 'Google Chrome'
  if (/firefox|fxios/i.test(ua)) return 'Mozilla Firefox'
  if (/safari/i.test(ua)) return 'Safari'
  return ua ? ua.slice(0, 40) : 'Unknown'
}

export default function ExecutiveProfile() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return <div><PageHeader title="Profile" /><Loader /></div>

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Profile" subtitle="Manage your personal information, account settings, and security preferences." />
      <ProfileInformation user={user} />
      <PersonalInformation user={user} onSaved={updateUser} />
      <AccountInformation user={user} />
      <ChangePassword />
      <Documents user={user} onSaved={updateUser} />
      <Preferences user={user} onSaved={updateUser} />
      <LoginSessions user={user} onLogout={handleLogout} />
      <LogoutSection onLogout={handleLogout} />
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  )
}

function Field({ label, value, readOnly }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}{readOnly && <span className="ml-1 text-[9px] text-slate-300">(read-only)</span>}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  )
}

function Avatar({ user, size = 'h-16 w-16 text-2xl' }) {
  const initial = (user?.name || 'U').charAt(0).toUpperCase()
  if (user?.avatar) return <img src={user.avatar} alt={user.name} className={`${size} rounded-full object-cover`} />
  return <div className={`${size} flex items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600`}>{initial}</div>
}

// ─── Section 1 — Profile Information (read-only) ─────────────────────────────────
function ProfileInformation({ user }) {
  return (
    <Section title="Profile Information">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
        <Avatar user={user} />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{user.name}</h2>
          <p className="text-sm text-slate-500">{user.designation || titleCase(user.role)}{user.branch ? ` · ${user.branch}` : ''}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Full Name" value={user.name} />
        <Field label="Employee ID" value={user.employeeId} readOnly />
        <Field label="Employee Code" value={user.employeeCode} readOnly />
        <Field label="Designation" value={user.designation} readOnly />
        <Field label="Department" value={user.department} readOnly />
        <Field label="Branch" value={user.branch} readOnly />
        <Field label="Reporting Manager" value={user.managerName} readOnly />
        <Field label="Date of Joining" value={user.joiningDate ? formatDate(user.joiningDate) : '—'} readOnly />
        <Field label="Employment Status" value={user.isActive ? 'Active' : 'Inactive'} readOnly />
      </dl>
    </Section>
  )
}

// ─── Section 2 — Personal Information (editable) ─────────────────────────────────
function PersonalInformation({ user, onSaved }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const blank = () => ({
    phone: user.phone || '', dob: user.dob ? user.dob.slice(0, 10) : '', gender: user.gender || '',
    bloodGroup: user.bloodGroup || '', maritalStatus: user.maritalStatus || '', address: user.address || '',
    emergencyContactName: user.emergencyContactName || '', emergencyContactNumber: user.emergencyContactNumber || '',
  })
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      const { data } = await authApi.updateProfile(form)
      onSaved(data.data.user)
      setEditing(false)
      toast.success('Personal information updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  if (editing) {
    return (
      <Section title="Personal Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Mobile Number" value={form.phone} onChange={set('phone')} />
          <Input label="Email Address" value={user.email} disabled />
          <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} />
          <Select label="Gender" value={form.gender} onChange={set('gender')}>
            <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </Select>
          <Input label="Blood Group" value={form.bloodGroup} onChange={set('bloodGroup')} placeholder="e.g. O+" />
          <Select label="Marital Status" value={form.maritalStatus} onChange={set('maritalStatus')}>
            <option value="">Select…</option><option value="single">Single</option><option value="married">Married</option><option value="other">Other</option>
          </Select>
          <div className="sm:col-span-2"><Input label="Address" value={form.address} onChange={set('address')} /></div>
          <Input label="Emergency Contact Name" value={form.emergencyContactName} onChange={set('emergencyContactName')} />
          <Input label="Emergency Contact Number" value={form.emergencyContactNumber} onChange={set('emergencyContactNumber')} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={busy}>Save</Button>
          <Button variant="secondary" onClick={() => { setForm(blank()); setEditing(false) }}>Cancel</Button>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Personal Information" action={<Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Mobile Number" value={user.phone} />
        <Field label="Email Address" value={user.email} readOnly />
        <Field label="Date of Birth" value={user.dob ? formatDate(user.dob) : '—'} />
        <Field label="Gender" value={user.gender ? titleCase(user.gender) : '—'} />
        <Field label="Blood Group" value={user.bloodGroup} />
        <Field label="Marital Status" value={user.maritalStatus ? titleCase(user.maritalStatus) : '—'} />
        <Field label="Address" value={user.address} />
        <Field label="Emergency Contact" value={user.emergencyContactName ? `${user.emergencyContactName}${user.emergencyContactNumber ? ` · ${user.emergencyContactNumber}` : ''}` : '—'} />
      </dl>
    </Section>
  )
}

// ─── Section 3 — Account Information (read-only) ─────────────────────────────────
function AccountInformation({ user }) {
  return (
    <Section title="Account Information">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Username" value={user.email} readOnly />
        <Field label="Official Email" value={user.email} readOnly />
        <Field label="Last Login" value={user.lastLoginAt ? formatDate(user.lastLoginAt, true) : '—'} readOnly />
        <Field label="Last Password Changed" value={user.passwordChangedAt ? formatDate(user.passwordChangedAt, true) : 'Never'} readOnly />
        <Field label="Account Status" value={user.isActive ? 'Active' : 'Inactive'} readOnly />
      </dl>
    </Section>
  )
}

// ─── Section 4 — Change Password ─────────────────────────────────────────────────
function ChangePassword() {
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword
  const canSubmit = form.currentPassword && form.newPassword.length >= 8 && !mismatch

  async function update() {
    setBusy(true)
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success('Password updated — please log in again')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally { setBusy(false) }
  }

  return (
    <Section title="Change Password">
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Current Password" type="password" value={form.currentPassword} onChange={set('currentPassword')} />
        <Input label="New Password" type="password" value={form.newPassword} onChange={set('newPassword')} />
        <Input label="Confirm New Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={mismatch ? 'Passwords do not match' : undefined} />
      </div>
      <p className="mt-2 text-xs text-slate-500">New password must be at least 8 characters. Your current password is required for verification. Updating it signs you out of all devices.</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={update} disabled={busy || !canSubmit}>Update Password</Button>
        <Button variant="secondary" onClick={() => setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })}>Cancel</Button>
      </div>
    </Section>
  )
}

// ─── Section 5 — Documents ───────────────────────────────────────────────────────
function Documents({ user, onSaved }) {
  const toast = useToast()
  const [busyType, setBusyType] = useState(null)
  const byType = (t) => (user.documents || []).filter((d) => d.type === t)

  async function upload(type, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData(); fd.append('file', file); fd.append('type', type); fd.append('label', file.name)
    setBusyType(type)
    try {
      const { data } = await authApi.uploadDocument(fd)
      onSaved(data.data.user)
      toast.success('Document uploaded')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally { setBusyType(null); e.target.value = '' }
  }

  return (
    <Section title="Documents">
      <p className="mb-3 text-xs text-slate-500">Upload or replace the documents permitted by the company.</p>
      <div className="space-y-2">
        {DOC_TYPES.map(([type, label]) => {
          const docs = byType(type)
          return (
            <div key={type} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{label}</div>
                {docs.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {docs.map((d) => (
                      <span key={d._id} className="text-slate-500">
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>
                        <a href={d.fileUrl} download className="ml-2 text-blue-600 underline">Download</a>
                        <span className="ml-2 text-slate-400">{d.fileName}</span>
                      </span>
                    ))}
                  </div>
                ) : <div className="text-xs text-slate-400">Not uploaded</div>}
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                {busyType === type ? 'Uploading…' : docs.length ? 'Replace' : 'Upload'}
                <input type="file" onChange={(e) => upload(type, e)} disabled={busyType === type} className="hidden" />
              </label>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ─── Section 6 — Preferences ─────────────────────────────────────────────────────
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}

function Preferences({ user, onSaved }) {
  const toast = useToast()
  const [prefs, setPrefs] = useState({
    language: user.preferences?.language || 'en',
    timeFormat: user.preferences?.timeFormat || '12h',
    dateFormat: user.preferences?.dateFormat || 'DD MMM YYYY',
  })
  const [notif, setNotif] = useState({ inApp: user.notificationPrefs?.inApp ?? true, email: user.notificationPrefs?.email ?? false })
  const [busy, setBusy] = useState(false)

  async function savePrefs(next) {
    setPrefs(next); setBusy(true)
    try { const { data } = await authApi.updateProfile({ preferences: next }); onSaved(data.data.user); toast.success('Preferences saved') }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }
  async function saveNotif(next) {
    setNotif(next); setBusy(true)
    try { const { data } = await authApi.updateProfile({ notificationPrefs: next }); onSaved(data.data.user) }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <Section title="Preferences">
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Language" value={prefs.language} onChange={(e) => savePrefs({ ...prefs, language: e.target.value })} disabled={busy}>
          <option value="en">English</option><option value="hi">Hindi</option><option value="mr">Marathi</option>
        </Select>
        <Select label="Time Format" value={prefs.timeFormat} onChange={(e) => savePrefs({ ...prefs, timeFormat: e.target.value })} disabled={busy}>
          <option value="12h">12 Hours</option><option value="24h">24 Hours</option>
        </Select>
        <Select label="Date Format" value={prefs.dateFormat} onChange={(e) => savePrefs({ ...prefs, dateFormat: e.target.value })} disabled={busy}>
          <option value="DD MMM YYYY">DD MMM YYYY</option><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option>
        </Select>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Notification Preferences</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="In-App Notifications" checked={notif.inApp} onChange={(v) => !busy && saveNotif({ ...notif, inApp: v })} />
          <Toggle label="Email Notifications" checked={notif.email} onChange={(v) => !busy && saveNotif({ ...notif, email: v })} />
        </div>
      </div>
    </Section>
  )
}

// ─── Section 7 — Login Sessions ──────────────────────────────────────────────────
function LoginSessions({ user, onLogout }) {
  return (
    <Section title="Login Sessions">
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Current Session</span>
          <Button size="sm" variant="danger" onClick={onLogout}>Logout from Current Device</Button>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Current Device" value="This device" />
          <Field label="Browser" value={browserOf(user.lastLoginDevice)} />
          <Field label="Login Time" value={user.lastLoginAt ? formatDate(user.lastLoginAt, true) : '—'} />
          <Field label="Last Active" value="Now" />
        </dl>
      </div>
    </Section>
  )
}

// ─── Section 8 — Logout ──────────────────────────────────────────────────────────
function LogoutSection({ onLogout }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <Section title="Logout">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Sign out of your account on this device.</p>
        <Button variant="danger" onClick={() => setConfirm(true)}>Logout</Button>
      </div>
      {confirm && (
        <Modal open onClose={() => setConfirm(false)} title="Logout"
          footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>No</Button><Button variant="danger" onClick={onLogout}>Logout</Button></>}
        >
          <p className="text-sm text-slate-700">Are you sure you want to logout?</p>
        </Modal>
      )}
    </Section>
  )
}
