import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth.api.js'

// Two-step reset: request OTP, then submit OTP + new password (§2 flow).
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-11 text-slate-900 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
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
