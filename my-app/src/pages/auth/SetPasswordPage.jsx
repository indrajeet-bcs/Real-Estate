import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../../api/auth.api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ROLE_HOME } from '../../lib/constants.js'

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { login } = useAuth()

  const urlEmail = searchParams.get('email') || ''
  const urlOtp = searchParams.get('otp') || ''

  const [email, setEmail] = useState(urlEmail)
  const [otp, setOtp] = useState(urlOtp)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (urlEmail) setEmail(urlEmail)
    if (urlOtp) setOtp(urlOtp)
  }, [urlEmail, urlOtp])

  // Password validation rules
  const hasMinLength = newPassword.length >= 8
  const hasNumber = /\d/.test(newPassword)
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isOtpValid = otp.trim().length >= 4
  const canSubmit = email.trim() && isOtpValid && hasMinLength && isMatch && !busy

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setBusy(true)
    setError('')

    try {
      const res = await authApi.setPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      })

      setSuccess(true)
      toast.success('Password set successfully! Activating your account…')

      // Automatically sign them in with their newly created password
      try {
        const loggedInUser = await login(email.trim().toLowerCase(), newPassword)
        const dest = ROLE_HOME[loggedInUser.role] || '/'
        setTimeout(() => navigate(dest, { replace: true }), 1000)
      } catch {
        // Fallback to login page if immediate auto-login is blocked
        setTimeout(() => navigate('/login', { state: { email }, replace: true }), 1500)
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to set password. Please check your OTP and try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-md shadow-blue-500/20">
            RE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Real Estate CRM</h1>
          <p className="mt-1 text-sm text-slate-600">Account Activation &amp; Password Setup</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Set Your Permanent Password</h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Welcome to the team! Enter the One-Time Password (OTP) sent to your email to verify your identity and choose your permanent password.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">check_circle</span>
              <span>Password set successfully! Redirecting you to your dashboard…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Address */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Registered Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* One-Time Password */}
            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>One-Time Password (OTP)</span>
                <span className="text-[10px] font-normal text-slate-400">Check your inbox</span>
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Choose New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showNewPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Password Validation Checklist */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] space-y-1 text-slate-600">
              <div className="flex items-center gap-1.5 font-medium text-slate-700 mb-1">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                <span>Password Requirements:</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <span>{hasMinLength ? '✓' : '•'}</span>
                <span>At least 8 characters long</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <span>{hasNumber ? '✓' : '•'}</span>
                <span>Contains at least 1 number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${isMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <span>{isMatch ? '✓' : '•'}</span>
                <span>Both passwords match</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Activating Account…' : 'Set Password & Sign In'}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Already have your password set?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
