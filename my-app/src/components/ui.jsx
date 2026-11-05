import { useState, useEffect, useRef, useMemo, Children } from 'react'
import { STATUS_COLORS, titleCase } from '../lib/format.js'
import { useBodyScrollLock, lockBodyScroll } from '../hooks/useBodyScrollLock.js'
export { useBodyScrollLock, lockBodyScroll }

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
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none transition-all duration-200 hover:border-blue-400 hover:bg-slate-50/70 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200'

export function renderFieldLabel(label, required) {
  if (!label) return null
  const isReq = Boolean(required || (typeof label === 'string' && (/\*\s*$/.test(label) || /\s+\*\s*/.test(label))))
  const cleanLabel = typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label

  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
      {cleanLabel}
      {isReq && <span className="ml-1 font-bold text-red-500" title="Mandatory field">*</span>}
    </span>
  )
}

export function Input({ label, error, required, className = '', type, ...props }) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type
  const isRequired = required || props.required

  return (
    <label className="block">
      {renderFieldLabel(label, isRequired)}
      <div className="relative">
        <input
          type={inputType}
          required={isRequired}
          className={`${fieldCls} ${isPassword ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowPassword((prev) => !prev)
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Textarea({ label, required, className = '', ...props }) {
  const isRequired = required || props.required
  return (
    <label className="block">
      {renderFieldLabel(label, isRequired)}
      <textarea required={isRequired} className={`${fieldCls} min-h-[80px] ${className}`} {...props} />
    </label>
  )
}

export function Select({ label, children, required, className = '', containerClassName = '', error, ...props }) {
  const isRequired = required || props.required
  return (
    <label className={`block ${containerClassName}`}>
      {renderFieldLabel(label, isRequired)}
      <div className="group relative">
        <select
          required={isRequired}
          className={`w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm font-medium text-slate-800 shadow-xs outline-none transition-all duration-200 cursor-pointer hover:border-blue-400 hover:bg-slate-50/70 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 ${className}`}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-all duration-200 group-hover:text-blue-600 group-focus-within:text-blue-600 group-focus-within:rotate-180">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

// Redesigned modern Custom Dropdown Selection Menu with smooth animated open/close transitions,
// clear hover/active states, clean borders, proper padding, and full keyboard/click-outside support.
export function DropdownSelect({
  label,
  value,
  onChange,
  options = [],
  children,
  placeholder = 'Select option...',
  required = false,
  disabled = false,
  className = '',
  containerClassName = '',
  error,
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Normalize options from either options prop or children (<option value="...">label</option>)
  const normalizedOptions = useMemo(() => {
    if (options && options.length > 0) {
      return options.map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            value: opt.value ?? '',
            label: opt.label ?? String(opt.value ?? ''),
            icon: opt.icon,
            badge: opt.badge,
            disabled: opt.disabled,
          }
        }
        return { value: opt, label: String(opt) }
      })
    }
    if (children) {
      const list = []
      Children.forEach(children, (child) => {
        if (child && child.props) {
          list.push({
            value: child.props.value ?? '',
            label: child.props.children ?? String(child.props.value ?? ''),
            disabled: child.props.disabled,
          })
        }
      })
      return list
    }
    return []
  }, [options, children])

  const selectedOption = normalizedOptions.find((o) => String(o.value) === String(value))

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (val) => {
    // Fire callback with synthetic or direct value
    if (typeof onChange === 'function') {
      onChange({ target: { value: val } })
    }
    setOpen(false)
  }

  return (
    <div ref={dropdownRef} className={`relative ${containerClassName}`}>
      {renderFieldLabel(label, required)}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex w-full items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm font-medium shadow-xs outline-none transition-all duration-200 cursor-pointer ${
          open
            ? 'border-blue-600 ring-4 ring-blue-500/15'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70'
        } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200' : 'text-slate-800'} ${className}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {selectedOption?.icon && (
            <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-blue-500 transition-colors">
              {selectedOption.icon}
            </span>
          )}
          <span className={selectedOption ? 'text-slate-900 font-medium truncate' : 'text-slate-400 truncate'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <span
          className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-200 ease-out group-hover:text-blue-600 ${
            open ? 'rotate-180 text-blue-600' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown Menu Panel with smooth open/close transition */}
      <div
        className={`absolute z-50 mt-1.5 w-full min-w-[180px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all duration-200 ease-out origin-top ${
          open
            ? 'opacity-100 scale-100 translate-y-0 visible'
            : 'opacity-0 scale-95 -translate-y-1 invisible pointer-events-none'
        }`}
      >
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">No options available</div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value)
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-blue-50/50'
                  } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && (
                      <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                        {opt.icon}
                      </span>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">
                      check
                    </span>
                  )}
                  {opt.badge && !isSelected && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {opt.badge}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  )
}

// Action dropdown menu with smooth open/close animations, icons, and clear hover/active states.
export function ActionDropdown({ label = 'Actions', items = [], align = 'right', className = '', size = 'sm' }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-xs transition-all duration-200 hover:border-blue-400 hover:bg-slate-50 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-slate-100 cursor-pointer ${
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        }`}
      >
        <span>{label}</span>
        <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-blue-600' : ''}`}>
          expand_more
        </span>
      </button>

      <div
        className={`absolute z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all duration-200 ease-out origin-top ${
          align === 'left' ? 'left-0' : 'right-0'
        } ${
          open
            ? 'opacity-100 scale-100 translate-y-0 visible'
            : 'opacity-0 scale-95 -translate-y-1 invisible pointer-events-none'
        }`}
      >
        <div className="space-y-0.5">
          {items.map((it, idx) => (
            <button
              key={it.key || idx}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onClick?.()
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition duration-150 text-left cursor-pointer ${
                it.danger
                  ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {it.icon && (
                <span className={`material-symbols-outlined text-[16px] ${it.danger ? 'text-red-500' : 'text-slate-400'}`}>
                  {it.icon}
                </span>
              )}
              <span className="flex-1 truncate">{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
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
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, onClick, className = '', type, ...props }) {
  return (
    <Card
      className={`p-5 transition-all ${onClick ? 'cursor-pointer hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5' : ''
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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm thin-scroll">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-4 py-3 font-medium">{c.header}</th>
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
  const [isCustomLimit, setIsCustomLimit] = useState(false)
  const [customLimitInput, setCustomLimitInput] = useState('')

  if (!meta || (meta.total || 0) === 0) return null

  const page = Math.max(1, Number(meta.page) || 1)
  const total = Number(meta.total) || 0
  const limit = Math.max(1, Number(meta.limit) || pageSizeOptions[0] || 20)
  const pages = Math.max(1, Number(meta.pages) || Math.ceil(total / limit) || 1)

  const from = Math.min((page - 1) * limit + 1, total)
  const to = Math.min(page * limit, total)
  const fmt = (n) => n.toLocaleString('en-IN')

  const baseOpts = [5, 10, 15, 20, 25, 50, 100, 200, 500]
  const sizeOpts = [...new Set([...pageSizeOptions, ...baseOpts, limit])].sort((a, b) => a - b)

  const go = (p) => {
    if (!loading && typeof onPage === 'function') {
      onPage(p)
    }
  }

  const goToJump = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const raw = jump.trim()
    let target = page
    if (raw) {
      const n = parseInt(raw, 10)
      if (isNaN(n) || n < 1) {
        setInvalid(true)
        return
      }
      // Gracefully clamp to [1, pages] so any customizable number navigates safely
      target = Math.max(1, Math.min(n, pages))
    }
    setInvalid(false)
    setJump('')
    go(target)
  }

  const handleCustomLimitSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const n = parseInt(customLimitInput, 10)
    if (n && n > 0 && typeof onPageSize === 'function') {
      onPageSize(n)
      setIsCustomLimit(false)
    }
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
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Rows per page</span>
            {!isCustomLimit ? (
              <select
                value={sizeOpts.includes(limit) ? limit : 'custom'}
                disabled={loading}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomLimit(true)
                    setCustomLimitInput(String(limit))
                  } else {
                    onPageSize(Number(e.target.value))
                  }
                }}
                className={`${pgCtl} cursor-pointer pl-3 pr-8 hover:bg-slate-50`}
              >
                {sizeOpts.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            ) : (
              <form onSubmit={handleCustomLimitSubmit} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={customLimitInput}
                  onChange={(e) => setCustomLimitInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 30"
                  autoFocus
                  className="h-11 w-20 rounded-lg border border-blue-500 px-2 text-center text-sm shadow-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !customLimitInput || parseInt(customLimitInput, 10) < 1}
                  className={`${pgBtn} px-3 text-xs`}
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomLimit(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                  title="Cancel custom rows"
                >
                  ✕
                </button>
              </form>
            )}
          </div>
        )}

        {/* Go to page control - always available when there are records */}
        <form onSubmit={goToJump} className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Go to</span>
          <input
            value={jump}
            inputMode="numeric"
            disabled={loading}
            placeholder={String(page)}
            aria-label={`Jump to page (1 to ${pages})`}
            aria-invalid={invalid}
            title={invalid ? `Enter a valid page number (1 to ${pages})` : `Jump to a page (1–${pages})`}
            onChange={(e) => {
              setJump(e.target.value.replace(/[^0-9]/g, ''))
              if (invalid) setInvalid(false)
            }}
            className={`h-11 w-16 rounded-lg border px-2 text-center text-sm shadow-sm outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-offset-1 ${
              invalid ? 'border-red-400 text-red-600 focus-visible:ring-red-400' : 'border-slate-300 text-slate-700 focus-visible:ring-blue-500'
            }`}
          />
          <button type="submit" disabled={loading} className={`${pgBtn} px-4 font-semibold text-blue-600 hover:text-blue-700`}>
            Go
          </button>
        </form>
      </div>
    </div>
  )
}

// --- Modal ---
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useBodyScrollLock(open)
  if (!open) return null
  return (
<<<<<<< HEAD
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 overscroll-contain backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && typeof onClose === 'function') onClose()
      }}
    >
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-slate-200 bg-white shadow-2xl overscroll-contain`}
=======
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6 backdrop-blur-sm">
      <div
        className={`flex max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
>>>>>>> 29c44943f8ef916e8d5fecd85ed39ea501c3fbf5
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="thin-scroll flex-1 scroll-smooth overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="shrink-0 flex justify-end gap-2 border-t border-slate-200 px-6 py-4">{footer}</div>}
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
