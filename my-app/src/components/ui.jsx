import { useState, useEffect, useRef } from 'react'
import { STATUS_COLORS, titleCase } from '../lib/format.js'

// --- Buttons ---
export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5' }
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

// --- Export menu ---
// One standardized "Export" split-button + dropdown, used for every report /
// list export action — page headers AND individual report cards. `items` =
// [{ key, label, icon (Material Symbols name), onClick }].
// Keyboard accessible (Arrow/Home/End/Escape), click-outside to close, focus mgmt,
// collapses to an icon-only button on mobile, and shows a loading state. Extend by
// passing more items (Copy, JSON, XML, Email, Share…) with no UI changes.
// `size`: 'md' (44px, page-level) | 'sm' (36px, report-card headers).
export function ExportMenu({ items = [], label = 'Export', disabled = false, loading = false, size = 'md', align = 'right', className = '' }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const close = (focusBtn) => { setOpen(false); if (focusBtn) btnRef.current?.focus() }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true) } }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus(), 0)
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [open])

  const onMenuKey = (e) => {
    const els = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus() }
  }

  const trigger = size === 'sm' ? 'h-9 px-3 gap-1.5' : 'h-11 px-3.5 gap-2'

  return (
    <div className={`relative ${className}`}>
      <button ref={btnRef} type="button" disabled={disabled || loading} aria-haspopup="menu" aria-expanded={open} aria-busy={loading} aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 shadow-sm outline-none transition duration-200 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${trigger}`}>
        <span className={`material-symbols-outlined text-[20px] leading-none ${loading ? 'animate-spin' : ''}`}>{loading ? 'progress_activity' : 'download'}</span>
        <span className="hidden sm:inline">{label}</span>
        <span className={`material-symbols-outlined hidden text-[20px] leading-none transition-transform duration-200 sm:inline ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => close(false)} aria-hidden="true" />
          <div ref={menuRef} role="menu" aria-label={label} onKeyDown={onMenuKey}
            className={`absolute z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150 ${align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}>
            {items.map((it) => (
              <button key={it.key} role="menuitem" type="button" onClick={() => { close(true); it.onClick?.() }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition duration-150 hover:bg-slate-100 focus:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500">
                {it.icon && <span className="material-symbols-outlined text-[20px] leading-none text-slate-400">{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// --- Inputs ---
const fieldCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

export function Input({ label, error, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <input className={`${fieldCls} ${className}`} {...props} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <textarea className={`${fieldCls} min-h-[80px] ${className}`} {...props} />
    </label>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select className={`${fieldCls} ${className}`} {...props}>
        {children}
      </select>
    </label>
  )
}

// --- Card / PageHeader / Stat ---
export function Card({ className = '', children, ...props }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} {...props}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, onClick, className = '' }) {
  return (
    <Card
      className={`p-5 transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value ?? '—'}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}

// --- Status badge ---
export function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {titleCase(status)}
    </span>
  )
}

// --- Table ---
export function Table({ columns, rows, empty = 'No records found', onRowClick }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 font-medium">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row._id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer transition hover:bg-slate-50' : ''}
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-slate-600">
                    {c.render ? c.render(row) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// --- Pagination ---
// Build the visible page list with ellipses, always keeping first + last and a
// window around the current page. Returns numbers and '…' markers.
function pageWindow(current, total, delta = 1) {
  if (total <= 1) return [1]
  const range = [1]
  const left = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)
  if (left > 2) range.push('…')
  for (let i = left; i <= right; i++) range.push(i)
  if (right < total - 1) range.push('…')
  range.push(total)
  return range
}

// Shared control styles (44px tall, 8px radius, soft shadow, full interaction states).
const pgCtl = 'h-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 shadow-sm outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1'
const pgBtn = `inline-flex items-center justify-center gap-1.5 ${pgCtl} px-3.5 font-medium hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none`
const chevronL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
const chevronR = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg>

// Standardized enterprise pagination used across every paginated list/table.
// `meta` = { page, pages, total, limit }. Pass `onPageSize` to enable the
// rows-per-page selector (the parent owns `limit` and should reset to page 1).
// Optional `loading` disables the controls while data is fetching.
export function Pagination({ meta, onPage, onPageSize, pageSizeOptions = [10, 20, 25, 50, 100], loading = false }) {
  const [jump, setJump] = useState('')
  const [invalid, setInvalid] = useState(false)
  if (!meta || (meta.total || 0) === 0) return null

  const page = meta.page || 1
  const pages = Math.max(1, meta.pages || 1)
  const total = meta.total || 0
  const limit = meta.limit || pageSizeOptions[0]
  if (pages <= 1 && !onPageSize) return null // nothing to page and no size control

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const fmt = (n) => n.toLocaleString('en-IN')
  const sizeOpts = [...new Set([...pageSizeOptions, limit])].sort((a, b) => a - b)
  const go = (p) => { if (!loading && p !== page) onPage(p) }

  const goToJump = () => {
    const n = Number(jump)
    if (!jump || !Number.isInteger(n) || n < 1 || n > pages) { setInvalid(true); return }
    setInvalid(false); setJump(''); go(n)
  }

  return (
    <div className={`mt-4 flex flex-col items-stretch gap-4 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between ${loading ? 'opacity-60' : ''}`}>
      {/* LEFT — record count */}
      <div className="order-1 text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{fmt(from)}–{fmt(to)}</span> of <span className="font-semibold text-slate-900">{fmt(total)}</span> records
      </div>

      {/* CENTER — Previous · page numbers · Next */}
      <nav className="order-3 flex flex-wrap items-center justify-center gap-1.5 md:order-2" aria-label="Pagination">
        <button type="button" className={pgBtn} disabled={loading || page <= 1} onClick={() => go(page - 1)}>
          {chevronL}<span>Previous</span>
        </button>

        {/* Numbered pages (tablet/desktop) */}
        <div className="hidden items-center gap-1.5 sm:flex">
          {pageWindow(page, pages).map((p, i) => p === '…'
            ? <span key={`e${i}`} className="inline-flex h-11 w-8 items-center justify-center text-slate-400">…</span>
            : (
              <button key={p} type="button" onClick={() => go(p)} disabled={loading} aria-current={p === page ? 'page' : undefined}
                className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm shadow-sm outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${p === page ? 'border-blue-600 bg-blue-600 font-semibold text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100'}`}>
                {p}
              </button>
            ))}
        </div>
        {/* Compact indicator (mobile) */}
        <span className="px-2 text-sm font-medium text-slate-600 sm:hidden">Page {page} / {pages}</span>

        <button type="button" className={pgBtn} disabled={loading || page >= pages} onClick={() => go(page + 1)}>
          <span>Next</span>{chevronR}
        </button>
      </nav>

      {/* RIGHT — rows per page · jump to page */}
      <div className="order-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:order-3 md:justify-end">
        {onPageSize && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Rows per page</span>
            <select value={limit} disabled={loading} onChange={(e) => onPageSize(Number(e.target.value))}
              className={`${pgCtl} cursor-pointer pl-3 pr-8 hover:bg-slate-50`}>
              {sizeOpts.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 lg:inline">Go to</span>
            <input value={jump} inputMode="numeric" disabled={loading} placeholder={String(page)}
              aria-label={`Jump to page (1 to ${pages})`} aria-invalid={invalid}
              title={invalid ? `Enter a page between 1 and ${pages}` : `Jump to a page (1–${pages})`}
              onChange={(e) => { setJump(e.target.value.replace(/[^0-9]/g, '')); if (invalid) setInvalid(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') goToJump() }}
              className={`h-11 w-16 rounded-lg border px-2 text-center text-sm shadow-sm outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-offset-1 ${invalid ? 'border-red-400 text-red-600 focus-visible:ring-red-400' : 'border-slate-300 text-slate-700 focus-visible:ring-blue-500'}`} />
            <button type="button" onClick={goToJump} disabled={loading} className={`${pgBtn} px-4`}>Go</button>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Modal ---
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20">
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-slate-200 bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="thin-scroll max-h-[70vh] scroll-smooth overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// --- Loading / Error / Empty states ---
export function Loader({ label = 'Loading…' }) {
  return <div className="py-16 text-center text-sm text-slate-400">{label}</div>
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-red-600">{message || 'Something went wrong'}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

// Labelled on/off switch for boolean preferences.
export function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${disabled ? 'border-slate-100 bg-slate-50 opacity-75' : 'border-slate-200 hover:bg-slate-50'}`}>
      <span className={`text-sm ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? (disabled ? 'bg-blue-300' : 'bg-blue-600') : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}
