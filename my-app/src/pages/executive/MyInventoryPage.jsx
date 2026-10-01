import { useState, useCallback, useMemo, useEffect } from 'react'
import { unitsApi, projectsApi, buildersApi, customersApi, visitsApi, bookingsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return v ? `₹${v.toLocaleString('en-IN')}` : '—'
}
const priceOf = (u) => u.currentPrice || u.price || u.basePrice || 0

const STATUS_META = {
  available: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  hold: { label: 'On Hold', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  token: { label: 'Token', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  reserved: { label: 'Reserved', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  booked: { label: 'Booked', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  registered: { label: 'Registered', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  possession: { label: 'Possession', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  sold: { label: 'Sold', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  blocked: { label: 'Blocked', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  locked: { label: 'Locked', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}
const StatusPill = ({ s }) => {
  const m = STATUS_META[s] || { label: titleCase(s), cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyInventoryPage() {
  const [view, setView] = useState('table')
  const [search, setSearch] = useState('')
  const [builder, setBuilder] = useState('all')
  const [project, setProject] = useState('all')
  const [propertyType, setPropertyType] = useState('all')
  const [configuration, setConfiguration] = useState('all')
  const [tower, setTower] = useState('all')
  const [status, setStatus] = useState('all')
  const [facing, setFacing] = useState('all')
  const [budget, setBudget] = useState('all')
  const [sort, setSort] = useState('recent')

  const [detailsFor, setDetailsFor] = useState(null)
  const [visitFor, setVisitFor] = useState(null)
  const [bookingFor, setBookingFor] = useState(null)
  const [shareFor, setShareFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => unitsApi.list({ limit: 500 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 200 }), []))
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 200 }), []))

  const units = data || []
  const projectMap = useMemo(() => {
    const m = {}
    ;(projects || []).forEach((p) => { m[String(p._id)] = { name: p.name, builderId: String(p.builder?._id || p.builder || ''), builderName: p.builder?.name } })
    return m
  }, [projects])
  const projOf = (u) => projectMap[String(u.project?._id || u.project)] || {}
  const builderNameOf = (u) => projOf(u).builderName || '—'

  const kpis = {
    builders: (builders || []).length,
    projects: (projects || []).filter((p) => (p.status || 'active') === 'active').length,
    available: units.filter((u) => u.status === 'available').length,
    reservedBooked: units.filter((u) => ['reserved', 'booked'].includes(u.status)).length,
  }

  const opts = useMemo(() => ({
    types: [...new Set(units.map((u) => u.propertyType).filter(Boolean))],
    configs: [...new Set(units.map((u) => u.configuration || u.unitType).filter(Boolean))],
    towers: [...new Set(units.map((u) => u.tower).filter(Boolean))],
    facings: [...new Set(units.map((u) => u.facing).filter(Boolean))],
  }), [units])

  const filtered = useMemo(() => {
    let out = units
    if (builder !== 'all') out = out.filter((u) => projOf(u).builderId === builder)
    if (project !== 'all') out = out.filter((u) => String(u.project?._id || u.project) === project)
    if (propertyType !== 'all') out = out.filter((u) => u.propertyType === propertyType)
    if (configuration !== 'all') out = out.filter((u) => (u.configuration || u.unitType) === configuration)
    if (tower !== 'all') out = out.filter((u) => u.tower === tower)
    if (status !== 'all') out = out.filter((u) => u.status === status)
    if (facing !== 'all') out = out.filter((u) => u.facing === facing)
    if (budget !== 'all') {
      out = out.filter((u) => {
        const p = priceOf(u)
        if (budget === 'lt50') return p > 0 && p < 5e6
        if (budget === '50to100') return p >= 5e6 && p <= 1e7
        if (budget === 'gt100') return p > 1e7
        return true
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((u) => [u.unitNumber, u.tower, projOf(u).name, builderNameOf(u)].some((v) => (v || '').toLowerCase().includes(q)))
    }
    const sorted = [...out]
    if (sort === 'price_asc') sorted.sort((a, b) => priceOf(a) - priceOf(b))
    else if (sort === 'price_desc') sorted.sort((a, b) => priceOf(b) - priceOf(a))
    else if (sort === 'area') sorted.sort((a, b) => (b.areaSqft || 0) - (a.areaSqft || 0))
    else sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return sorted
  }, [units, builder, project, propertyType, configuration, tower, status, facing, budget, search, sort, projectMap]) // eslint-disable-line

  const rowActions = (u) => (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(u) }}>View</Button>
      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setVisitFor(u) }}>Visit</Button>
      {u.status === 'available' && <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setBookingFor(u) }}>Book</Button>}
      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setShareFor(u) }}>Share</Button>
    </div>
  )

  const columns = [
    { key: 'builder', header: 'Builder', render: builderNameOf },
    { key: 'project', header: 'Project', render: (u) => projOf(u).name || '—' },
    { key: 'tower', header: 'Tower', render: (u) => u.tower || '—' },
    { key: 'floor', header: 'Floor', render: (u) => u.floor || '—' },
    { key: 'unit', header: 'Unit', render: (u) => u.unitNumber },
    { key: 'config', header: 'Configuration', render: (u) => u.configuration || u.unitType || '—' },
    { key: 'area', header: 'Carpet Area', render: (u) => (u.areaSqft ? `${u.areaSqft} sqft` : '—') },
    { key: 'price', header: 'Price', render: (u) => inr(priceOf(u)) },
    { key: 'status', header: 'Availability', render: (u) => <StatusPill s={u.status} /> },
    { key: 'actions', header: '', render: rowActions },
  ]

  return (
    <div>
      <PageHeader
        title="Property Inventory"
        subtitle="Browse available properties, explore project details, and help customers find the right property."
        actions={
          <div className="flex gap-1.5">
            <button onClick={() => setView('table')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'table' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'}`}>Table</button>
            <button onClick={() => setView('card')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'card' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600'}`}>Cards</button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Builders" value={kpis.builders} />
        <StatCard label="Active Projects" value={kpis.projects} />
        <StatCard label="Available Units" value={kpis.available} />
        <StatCard label="Reserved / Booked" value={kpis.reservedBooked} />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 md:col-span-1"><Input label="Search" placeholder="Builder, project, tower, unit" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select label="Builder" value={builder} onChange={(e) => setBuilder(e.target.value)}><option value="all">All</option>{(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</Select>
          <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All</option>{(projects || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
          <Select label="Property Type" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}><option value="all">All</option>{opts.types.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
          <Select label="Configuration" value={configuration} onChange={(e) => setConfiguration(e.target.value)}><option value="all">All</option>{opts.configs.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          <Select label="Tower" value={tower} onChange={(e) => setTower(e.target.value)}><option value="all">All</option>{opts.towers.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          <Select label="Unit Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{Object.keys(STATUS_META).filter((s) => s !== 'locked').map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</Select>
          <Select label="Facing" value={facing} onChange={(e) => setFacing(e.target.value)}><option value="all">All</option>{opts.facings.map((f) => <option key={f} value={f}>{f}</option>)}</Select>
          <Select label="Budget" value={budget} onChange={(e) => setBudget(e.target.value)}><option value="all">All</option><option value="lt50">Below ₹50 L</option><option value="50to100">₹50 L – ₹1 Cr</option><option value="gt100">Above ₹1 Cr</option></Select>
          <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Recently Added</option><option value="price_asc">Price (Low to High)</option><option value="price_desc">Price (High to Low)</option><option value="area">Area</option></Select>
        </div>
      </Card>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : view === 'table' ? (
        <Table columns={columns} rows={filtered} empty="No units match your filters." onRowClick={(u) => setDetailsFor(u)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 ? <p className="col-span-full py-16 text-center text-sm text-slate-400">No units match your filters.</p> : filtered.map((u) => (
            <div key={u._id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{projOf(u).name || '—'}</div>
                  <div className="text-xs text-slate-500">{builderNameOf(u)}</div>
                </div>
                <StatusPill s={u.status} />
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div><span className="text-slate-400">Unit</span> {u.unitNumber}</div>
                <div><span className="text-slate-400">Tower</span> {u.tower || '—'}</div>
                <div><span className="text-slate-400">Config</span> {u.configuration || u.unitType || '—'}</div>
                <div><span className="text-slate-400">Area</span> {u.areaSqft ? `${u.areaSqft} sqft` : '—'}</div>
              </div>
              <div className="mb-3 text-lg font-bold text-slate-900">{inr(priceOf(u))}</div>
              <div className="mt-auto">{rowActions(u)}</div>
            </div>
          ))}
        </div>
      )}

      {detailsFor && <PropertyDetailsDrawer unit={detailsFor} units={units} onClose={() => setDetailsFor(null)} onVisit={() => { setVisitFor(detailsFor); setDetailsFor(null) }} onBook={() => { setBookingFor(detailsFor); setDetailsFor(null) }} onShare={() => { setShareFor(detailsFor); setDetailsFor(null) }} />}
      {visitFor && <ScheduleVisitModal unit={visitFor} onClose={() => setVisitFor(null)} onDone={() => setVisitFor(null)} />}
      {bookingFor && <CreateBookingModal unit={bookingFor} onClose={() => setBookingFor(null)} onDone={() => { setBookingFor(null); refetch() }} />}
      {shareFor && <ShareModal unit={shareFor} projectName={projOf(shareFor).name} builderName={builderNameOf(shareFor)} onClose={() => setShareFor(null)} />}
    </div>
  )
}

// ─── Property Details Drawer (spec §Property Details — 7 sections) ───────────────
function PropertyDetailsDrawer({ unit, units, onClose, onVisit, onBook, onShare }) {
  const pid = unit.project?._id || unit.project
  const { data: project } = useFetch(useCallback(() => projectsApi.get(pid), [pid]))
  const p = project || {}
  const builderId = p.builder?._id || p.builder
  const { data: builder } = useFetch(useCallback(() => (builderId ? buildersApi.get(builderId) : Promise.resolve({ data: { data: null } })), [builderId]))
  const b = builder || {}

  const towerUnits = units.filter((u) => String(u.project?._id || u.project) === String(pid) && u.tower === unit.tower)
  const towerFloors = [...new Set(towerUnits.map((u) => u.floor).filter(Boolean))].length
  const amenities = p.amenities || []
  const mapUrl = p.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name || ''} ${p.location}`)}` : null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{p.name || unit.project?.name || 'Property'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">Unit {unit.unitNumber} · <StatusPill s={unit.status} /></p>
          </div>
          <button onClick={onClose} className="mt-0.5 rounded-lg p-1 text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <Section title="1 · Builder Information">
            <Info rows={[['Builder Name', b.name], ['About Builder', b.about || b.description], ['Contact', [b.contactPerson, b.phone, b.email].filter(Boolean).join(' · ')]]} />
          </Section>
          <Section title="2 · Project Information">
            <Info rows={[
              ['Project Name', p.name], ['Location', p.location], ['Possession Date', p.possessionDate ? formatDate(p.possessionDate) : null],
              ['Project Status', p.constructionStatus ? titleCase(p.constructionStatus) : null], ['RERA Number', p.reraNumber], ['Description', p.description],
            ]} />
          </Section>
          <Section title="3 · Amenities">
            {amenities.length === 0 ? <p className="text-xs italic text-slate-400">No amenities listed.</p> : (
              <div className="flex flex-wrap gap-1.5">{amenities.map((a) => <span key={a} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{titleCase(a)}</span>)}</div>
            )}
          </Section>
          <Section title="4 · Tower Information">
            <Info rows={[['Tower Name', unit.tower], ['Total Floors', towerFloors || null], ['Total Units', towerUnits.length || null]]} />
          </Section>
          <Section title="5 · Unit Information">
            <Info rows={[
              ['Unit Number', unit.unitNumber], ['Floor', unit.floor], ['Property Type', unit.propertyType ? titleCase(unit.propertyType) : null],
              ['Configuration', unit.configuration || unit.unitType], ['Carpet Area', unit.areaSqft ? `${unit.areaSqft} sqft` : null], ['Facing', unit.facing],
              ['Price', inr(priceOf(unit))], ['Availability', STATUS_META[unit.status]?.label || unit.status],
            ]} />
          </Section>
          <Section title="6 · Media">
            {p.image ? <img src={p.image} alt={p.name} className="max-h-48 w-full rounded-lg object-cover" /> : <p className="text-xs italic text-slate-400">No project images, floor plans, or unit layouts uploaded.</p>}
          </Section>
          <Section title="7 · Location">
            {p.location ? (
              <div className="text-sm text-slate-700">{p.location}{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 underline">Open in Google Maps</a>}</div>
            ) : <p className="text-xs italic text-slate-400">Location not available.</p>}
          </Section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          <Button size="sm" variant="secondary" onClick={onShare}>Share</Button>
          <Button size="sm" variant="secondary" onClick={onVisit}>Schedule Site Visit</Button>
          {unit.status === 'available' && <Button size="sm" variant="success" onClick={onBook}>Create Booking</Button>}
        </div>
      </div>
    </div>
  )
}

// ─── Schedule Site Visit (from inventory) ───────────────────────────────────────
function ScheduleVisitModal({ unit, onClose, onDone }) {
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [busy, setBusy] = useState(false)
  const projectId = unit.project?._id || unit.project

  useEffect(() => { customersApi.list({ limit: 500 }).then((r) => setCustomers(r.data.data || [])).catch(() => {}) }, [])

  async function save() {
    if (!customer || !scheduledAt) { toast.error('Select a customer, date & time'); return }
    setBusy(true)
    try {
      await visitsApi.create({ customer, project: projectId, unit: unit._id, scheduledAt })
      toast.success('Site visit scheduled')
      onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Schedule Site Visit — ${unit.unitNumber}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Schedule</Button></>}
    >
      <div className="space-y-4">
        <Select label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="">Select a customer…</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <Input label="Date & time" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <p className="text-xs text-slate-500">The visit is linked to this unit's project.</p>
      </div>
    </Modal>
  )
}

// ─── Create Booking (available units only) ──────────────────────────────────────
function CreateBookingModal({ unit, onClose, onDone }) {
  const toast = useToast()
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ customer: '', bookingAmount: String(Math.round(priceOf(unit) * 0.1) || ''), paymentMode: 'cheque', tokenAmount: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const projectId = unit.project?._id || unit.project

  useEffect(() => { customersApi.list({ limit: 500 }).then((r) => setCustomers(r.data.data || [])).catch(() => {}) }, [])

  async function save() {
    if (!form.customer || !(Number(form.bookingAmount) > 0)) { toast.error('Select a customer and booking amount'); return }
    setBusy(true)
    try {
      await bookingsApi.create({ customer: form.customer, project: projectId, unit: unit._id, bookingAmount: Number(form.bookingAmount), paymentMode: form.paymentMode, tokenAmount: form.tokenAmount ? Number(form.tokenAmount) : undefined, draft: false })
      toast.success('Booking submitted for approval')
      onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Booking failed') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Create Booking — ${unit.unitNumber}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Submit Booking</Button></>}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Unit</span><span className="font-medium">{unit.unitNumber} · {unit.configuration || unit.unitType}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">List Price</span><span className="font-medium">{inr(priceOf(unit))}</span></div>
        </div>
        <Select label="Customer" value={form.customer} onChange={set('customer')}>
          <option value="">Select a customer…</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Booking Amount" type="number" value={form.bookingAmount} onChange={set('bookingAmount')} />
          <Input label="Token Amount" type="number" value={form.tokenAmount} onChange={set('tokenAmount')} />
        </div>
        <Select label="Payment Mode" value={form.paymentMode} onChange={set('paymentMode')}>
          {['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
        </Select>
        <p className="text-xs text-slate-500">Only available units can be booked. The unit is reserved pending Sub-Admin approval.</p>
      </div>
    </Modal>
  )
}

// ─── Share Property ──────────────────────────────────────────────────────────────
function ShareModal({ unit, projectName, builderName, onClose }) {
  const toast = useToast()
  const text = [
    `🏠 ${projectName || 'Property'} by ${builderName || ''}`.trim(),
    `Unit: ${unit.unitNumber}${unit.tower ? ` · Tower ${unit.tower}` : ''}${unit.floor ? ` · Floor ${unit.floor}` : ''}`,
    `Configuration: ${unit.configuration || unit.unitType || '—'}${unit.areaSqft ? ` · ${unit.areaSqft} sqft` : ''}`,
    `Price: ${inr(priceOf(unit))}`,
    unit.facing ? `Facing: ${unit.facing}` : null,
  ].filter(Boolean).join('\n')

  function copy() { navigator.clipboard?.writeText(text).then(() => toast.success('Copied to clipboard')).catch(() => {}) }

  return (
    <Modal open onClose={onClose} title="Share Property"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={copy}>Copy</Button></>}
    >
      <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{text}</pre>
      <div className="mt-3 flex gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">Share on WhatsApp</a>
        <a href={`mailto:?subject=${encodeURIComponent(projectName || 'Property')}&body=${encodeURIComponent(text)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Email</a>
      </div>
    </Modal>
  )
}

function Section({ title, children }) {
  return <div><h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>{children}</div>
}
function Info({ rows }) {
  const shown = rows.filter(([, v]) => v || v === 0)
  if (!shown.length) return <p className="text-xs italic text-slate-400">—</p>
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {shown.map(([label, value]) => (
        <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value}</dd></div>
      ))}
    </dl>
  )
}
