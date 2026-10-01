import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_HOME } from '../lib/constants.js'

export default function NotFoundPage() {
  const { user } = useAuth()
  const home = user ? ROLE_HOME[user.role] || '/' : '/login'
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-center">
      <div className="text-6xl font-bold text-slate-300">404</div>
      <p className="mt-2 text-slate-600">This page doesn’t exist.</p>
      <Link to={home} className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Go back
      </Link>
    </div>
  )
}
