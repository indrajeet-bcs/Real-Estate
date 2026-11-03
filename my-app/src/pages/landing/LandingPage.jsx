import { useState } from 'react'
import { Link } from 'react-router-dom'

// ─── Feature data ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '👥',
    title: 'Lead Management',
    desc: 'Capture, assign, and track every lead from first contact to booking. Never lose a prospect again.',
  },
  {
    icon: '📅',
    title: 'Follow-up Scheduling',
    desc: 'Schedule follow-up calls, set reminders, and log outcomes. Stay on top of every conversation.',
  },
  {
    icon: '🏠',
    title: 'Site Visit Tracking',
    desc: 'Book and manage site visits with photo capture, GPS check-in, and visit outcome recording.',
  },
  {
    icon: '📊',
    title: 'Sales Reports',
    desc: 'Real-time dashboards for revenue, bookings, team performance, and lead conversion rates.',
  },
  {
    icon: '🏢',
    title: 'Multi-Branch Support',
    desc: 'Manage multiple branches and projects under one account. Each branch gets its own team and data.',
  },
  {
    icon: '🔐',
    title: 'Role-Based Access',
    desc: 'Superadmin, Admin, Sub-Admin, and Sales Executive roles — each with precisely controlled permissions.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Request Access',
    desc: 'Contact us to set up your company account. We configure your firm, branches, and admin user.',
  },
  {
    num: '02',
    title: 'Set Up Your Team',
    desc: 'Add your sales executives and sub-admins. Assign branches, set targets, and import leads.',
  },
  {
    num: '03',
    title: 'Start Selling',
    desc: 'Your team logs in and manages leads, follow-ups, site visits, and bookings — all in one place.',
  },
]

const STATS = [
  { value: '500+', label: 'Active Users' },
  { value: '50+', label: 'Real Estate Firms' },
  { value: '10,000+', label: 'Leads Tracked' },
  { value: '99.9%', label: 'Uptime' },
]

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm">
            RE
          </div>
          <span className="text-base font-semibold text-slate-900">Real Estate CRM</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-slate-600 transition hover:text-blue-600">Features</a>
          <a href="#how-it-works" className="text-sm text-slate-600 transition hover:text-blue-600">How It Works</a>
          <a href="#contact" className="text-sm text-slate-600 transition hover:text-blue-600">Contact</a>
        </div>

        {/* Login button */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800"
          >
            Login
          </Link>
          {/* Mobile menu toggle */}
          <button
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-6 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <a href="#features" className="text-sm text-slate-700" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="text-sm text-slate-700" onClick={() => setMenuOpen(false)}>How It Works</a>
            <a href="#contact" className="text-sm text-slate-700" onClick={() => setMenuOpen(false)}>Contact</a>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 pb-24 pt-36 text-white">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Built for Indian Real Estate Teams
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          Close More Deals with
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Smart CRM for Real Estate
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
          Manage leads, follow-ups, site visits, bookings, and your entire sales team — all from
          one powerful platform designed for real estate agencies.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-500 hover:-translate-y-0.5 active:translate-y-0"
          >
            Login to Dashboard →
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            Explore Features
          </a>
        </div>

        {/* Stats bar */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur-sm">
              <div className="text-3xl font-bold text-white">{s.value}</div>
              <div className="mt-1 text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
            Features
          </span>
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Everything Your Sales Team Needs
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            From lead capture to final booking, Real Estate CRM covers every stage of your sales process.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="mb-4 text-4xl">{f.icon}</div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
            How It Works
          </span>
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Up and Running in 3 Steps
          </h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connector line on desktop */}
          <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent md:block" />

          {STEPS.map((s) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-200">
                {s.num}
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="bg-blue-600 py-16">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Ready to Streamline Your Real Estate Sales?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-blue-100">
          Log in to your dashboard or contact us to get your team on board.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-blue-600 shadow-lg transition hover:bg-slate-50 hover:-translate-y-0.5"
          >
            Login to CRM →
          </Link>
          <a
            href="#contact"
            className="rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
          >
            Contact Us
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── Contact Section ──────────────────────────────────────────────────────────
function Contact() {
  return (
    <section id="contact" className="bg-white py-20">
      <div className="mx-auto max-w-xl px-6 text-center">
        <span className="mb-3 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
          Contact
        </span>
        <h2 className="text-3xl font-bold text-slate-900">Get in Touch</h2>
        <p className="mx-auto mt-4 text-base text-slate-600">
          Want to set up your real estate firm on our platform? Reach out and we'll get you started.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 text-sm text-slate-700">
          <a href="mailto:support@realestate-crm.com" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 transition hover:border-blue-300 hover:text-blue-600">
            📧 support@realestate-crm.com
          </a>
          <a href="tel:+919999999999" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 transition hover:border-blue-300 hover:text-blue-600">
            📞 +91 99999 99999
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 py-10 text-center">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            RE
          </div>
          <span className="text-sm font-medium text-slate-300">Real Estate CRM</span>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          © {new Date().getFullYear()} Real Estate CRM. All rights reserved.
        </p>
        <div className="mt-4 flex items-center justify-center gap-6">
          <Link to="/login" className="text-xs text-slate-500 transition hover:text-slate-300">Login</Link>
          <a href="#features" className="text-xs text-slate-500 transition hover:text-slate-300">Features</a>
          <a href="#how-it-works" className="text-xs text-slate-500 transition hover:text-slate-300">How It Works</a>
          <a href="#contact" className="text-xs text-slate-500 transition hover:text-slate-300">Contact</a>
        </div>
      </div>
    </footer>
  )
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTABanner />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}

