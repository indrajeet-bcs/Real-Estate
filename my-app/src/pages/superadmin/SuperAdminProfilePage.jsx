import { useState, useEffect } from 'react'
import { Card, Button, Input } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'

export default function SuperAdminProfilePage() {
  const { user } = useAuth()
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Section 1: Personal Info
  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || 'Super Admin',
    mobile: '+1 (555) 123-4567',
    designation: 'Platform Owner',
    bio: 'Responsible for overseeing the entire Real Estate SaaS Platform, managing global configurations, and ensuring system stability.'
  })

  // Section 2: Account Details (read-only/system)
  const accountDetails = {
    userId: user?.id || user?._id || 'USR-SA-001',
    email: user?.email || 'superadmin@crm.local',
    role: 'Super Admin (System Owner)',
    scope: 'All Firms & System Wide',
    accountStatus: 'Active',
    joinedDate: 'Jan 15, 2024'
  }

  // Section 3: Security & Password
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
  const [passError, setPassError] = useState('')

  // Section 4: Login History
  const loginHistory = [
    { id: 1, date: 'Today, 10:45 AM', ip: '192.168.1.42', device: 'MacBook Pro', browser: 'Chrome 120', status: 'Success' },
    { id: 2, date: 'Yesterday, 04:12 PM', ip: '192.168.1.42', device: 'MacBook Pro', browser: 'Chrome 120', status: 'Success' },
    { id: 3, date: 'Oct 15, 2026, 08:30 PM', ip: '172.16.254.1', device: 'iPhone 15 Pro', browser: 'Safari Mobile', status: 'Success' },
    { id: 4, date: 'Oct 14, 2026, 11:20 AM', ip: '203.0.113.45', device: 'Windows PC', browser: 'Edge', status: 'Failed' },
    { id: 5, date: 'Oct 12, 2026, 09:00 AM', ip: '192.168.1.42', device: 'MacBook Pro', browser: 'Chrome 120', status: 'Success' }
  ]

  // Section 5: Preferences (persisted in localStorage)
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_user_preferences')
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return {
      theme: theme || 'Light',
      language: 'English (US)',
      timeZone: 'UTC+05:30 India Standard Time',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h'
    }
  })

  useEffect(() => {
    if (theme) {
      setPreferences(prev => ({ ...prev, theme }))
    }
  }, [theme])

  // Section 6: Active Sessions
  const [sessions, setSessions] = useState([
    { id: 's1', device: 'MacBook Pro 16"', browser: 'Chrome 120', os: 'macOS Sonoma', loginTime: 'Today, 10:45 AM', lastActive: 'Current Session', current: true },
    { id: 's2', device: 'iPhone 15 Pro', browser: 'Safari Mobile', os: 'iOS 17', loginTime: 'Oct 15, 2026', lastActive: '2 hours ago', current: false },
    { id: 's3', device: 'Windows Desktop', browser: 'Firefox 119', os: 'Windows 11', loginTime: 'Oct 10, 2026', lastActive: '5 days ago', current: false }
  ])

  // Handlers
  const handleThemeChange = (newTheme) => {
    const next = { ...preferences, theme: newTheme }
    setPreferences(next)
    setTheme(newTheme)
    try {
      localStorage.setItem('crm_user_preferences', JSON.stringify(next))
    } catch {
      // ignore
    }
    toast.success(`Theme switched to ${newTheme}`)
  }

  const handlePreferenceChange = (key, value, label) => {
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    try {
      localStorage.setItem('crm_user_preferences', JSON.stringify(next))
    } catch {
      // ignore
    }
    toast.success(`${label || key} updated to ${value}`)
  }

  const handleSaveProfile = () => {
    setIsSaving(true)
    setTimeout(() => {
      setTheme(preferences.theme)
      try {
        localStorage.setItem('crm_user_preferences', JSON.stringify(preferences))
      } catch {
        // ignore
      }
      setIsSaving(false)
      setIsEditing(false)
      toast.success('Profile settings saved successfully.')
    }, 600)
  }

  const handleChangePassword = (e) => {
    e.preventDefault()
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      setPassError('Please fill in all password fields.')
      return
    }
    if (passwords.newPass !== passwords.confirm) {
      setPassError('New password and confirmation do not match.')
      return
    }
    if (passwords.newPass.length < 8) {
      setPassError('Password must be at least 8 characters long.')
      return
    }

    setPassError('')
    setPasswords({ current: '', newPass: '', confirm: '' })
    toast.success('Password updated successfully.')
  }

  const handleRevokeSession = (sessionId) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    toast.info('Session terminated.')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Banner / Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white shadow-md">
              {personalInfo.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{personalInfo.name}</h1>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                  {accountDetails.role}
                </span>
              </div>
              <p className="text-sm text-slate-500">{accountDetails.email}</p>
            </div>
          </div>
          <div>
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Personal info & Account info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Section 1: Personal Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Personal Information</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                {isEditing ? (
                  <Input 
                    value={personalInfo.name} 
                    onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} 
                  />
                ) : (
                  <p className="text-sm text-slate-900 py-1">{personalInfo.name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Designation</label>
                {isEditing ? (
                  <Input 
                    value={personalInfo.designation} 
                    onChange={e => setPersonalInfo({...personalInfo, designation: e.target.value})} 
                  />
                ) : (
                  <p className="text-sm text-slate-900 py-1">{personalInfo.designation}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contact Number</label>
                {isEditing ? (
                  <Input 
                    value={personalInfo.mobile} 
                    onChange={e => setPersonalInfo({...personalInfo, mobile: e.target.value})} 
                  />
                ) : (
                  <p className="text-sm text-slate-900 py-1">{personalInfo.mobile}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bio</label>
                {isEditing ? (
                  <textarea 
                    rows={3} 
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={personalInfo.bio} 
                    onChange={e => setPersonalInfo({...personalInfo, bio: e.target.value})} 
                  />
                ) : (
                  <p className="text-sm text-slate-600 py-1">{personalInfo.bio}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Section 3: Security & Password */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Security & Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passError && (
                <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-600 border border-rose-200">
                  {passError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
                <Input 
                  type="password" 
                  value={passwords.current} 
                  onChange={e => setPasswords({...passwords, current: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                  <Input 
                    type="password" 
                    value={passwords.newPass} 
                    onChange={e => setPasswords({...passwords, newPass: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
                  <Input 
                    type="password" 
                    value={passwords.confirm} 
                    onChange={e => setPasswords({...passwords, confirm: e.target.value})} 
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="secondary">
                  Update Password
                </Button>
              </div>
            </form>
          </Card>

          {/* Section 4: Login History */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Recent Login History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Date & Time</th>
                    <th className="py-2 px-3">IP Address</th>
                    <th className="py-2 px-3">Device / Browser</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-800">{item.date}</td>
                      <td className="py-2.5 px-3">{item.ip}</td>
                      <td className="py-2.5 px-3">{item.device} ({item.browser})</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === 'Success' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column: Account & Preferences & Sessions */}
        <div className="space-y-6">
          {/* Section 2: Account Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Account Overview</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">User ID</span>
                <span className="font-mono font-medium text-slate-700">{accountDetails.userId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Access Scope</span>
                <span className="font-medium text-slate-800">{accountDetails.scope}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Account Status</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  {accountDetails.accountStatus}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Member Since</span>
                <span className="text-slate-700">{accountDetails.joinedDate}</span>
              </div>
            </div>
          </Card>

          {/* Section 5: Preferences (Fully Interactive 1-Click Controls) */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-100 pb-2">Preferences</h2>
            <div className="space-y-5">
              {/* Interactive Theme Selector Options */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'Light', label: 'Light', icon: 'light_mode' },
                    { key: 'Dark', label: 'Dark', icon: 'dark_mode' },
                    { key: 'System Default', label: 'System', icon: 'devices' }
                  ].map((t) => {
                    const active = (preferences.theme || theme) === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => handleThemeChange(t.key)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Interactive Language Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Language</label>
                <select 
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  value={preferences.language}
                  onChange={e => handlePreferenceChange('language', e.target.value, 'Language')}
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="English (India)">English (India)</option>
                </select>
              </div>

              {/* Interactive Time Zone Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Time Zone</label>
                <select 
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  value={preferences.timeZone}
                  onChange={e => handlePreferenceChange('timeZone', e.target.value, 'Time Zone')}
                >
                  <option value="UTC+05:30 India Standard Time">UTC+05:30 India Standard Time (IST)</option>
                  <option value="UTC-05:00 Eastern Time">UTC-05:00 Eastern Time (US & Canada)</option>
                  <option value="UTC-08:00 Pacific Time">UTC-08:00 Pacific Time (US & Canada)</option>
                  <option value="UTC+00:00 London">UTC+00:00 London (GMT / UTC)</option>
                  <option value="UTC+01:00 Central European Time">UTC+01:00 Central European Time (CET)</option>
                  <option value="UTC+04:00 Dubai">UTC+04:00 Dubai (GST)</option>
                  <option value="UTC+08:00 Singapore">UTC+08:00 Singapore / Hong Kong (SGT)</option>
                  <option value="UTC+09:00 Tokyo">UTC+09:00 Tokyo (JST)</option>
                </select>
              </div>

              {/* Interactive Date Format Selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Date Format</label>
                <select 
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  value={preferences.dateFormat}
                  onChange={e => handlePreferenceChange('dateFormat', e.target.value, 'Date Format')}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 31/10/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/31/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-31)</option>
                  <option value="DD MMM YYYY">DD MMM YYYY (e.g. 31 Oct 2026)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Section 6: Active Sessions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Active Sessions</h2>
            <div className="space-y-4">
              {sessions.map(s => (
                <div key={s.id} className="flex items-start justify-between rounded-lg border border-slate-100 p-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{s.device}</span>
                      {s.current && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{s.browser} on {s.os}</p>
                    <p className="mt-1 text-[11px] text-slate-400">Active: {s.lastActive}</p>
                  </div>
                  {!s.current && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => handleRevokeSession(s.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
