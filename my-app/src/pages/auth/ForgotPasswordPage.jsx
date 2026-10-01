import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth.api.js'

// Two-step reset: request OTP, then submit OTP + new password (§2 flow).
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestOtp(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const { data } = await authApi.forgotPassword(email)
      setMessage(
        data.data?.devOtp
          ? `OTP sent. (Dev OTP: ${data.data.devOtp})`
          : 'If the account exists, an OTP has been sent.'
      )
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function submitReset(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await authApi.resetPassword({ email, otp, newPassword })
      setMessage('Password reset successful. You can now sign in.')
      setStep('done')
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Reset password</h1>
        <p className="mb-6 text-sm text-slate-600">
          {step === 'request' && "Enter your email and we'll send a one-time code."}
          {step === 'reset' && 'Enter the code and choose a new password.'}
          {step === 'done' && 'All set.'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-blue-500"
            />
            <button
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="space-y-4">
            <input
              type="text"
              required
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-blue-500"
            />
            <input
              type="password"
              required
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-blue-500"
            />
            <button
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
