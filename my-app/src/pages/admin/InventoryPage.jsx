import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildersApi, projectsApi, unitsApi, customersApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatMoney, formatDate, titleCase } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Textarea, Table, StatusBadge, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// Compact icon action buttons (match the branches/employees row-action style).
const ICONS = {
  eye: (<><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.43 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>),
  pencil: (<path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />),
  lock: (<><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>),
  unlock: (<><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.874-1" /></>),
  transfer: (<path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-9L21 7.5m0 0L16.5 3m4.5 4.5H7.5" />),
  doc: (<><path d="M9 12h6m-6 4h6M9 8h2" /><path d="M6.75 3h7.5L18 6.75v12A2.25 2.25 0 0 1 15.75 21h-9A2.25 2.25 0 0 1 4.5 18.75V5.25A2.25 2.25 0 0 1 6.75 3Z" /></>),
  power: (<path d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />),
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>),
}
const TONES = {
  slate: 'border-slate-200 text-slate-600 hover:bg-slate-50',
  amber: 'border-amber-200 text-amber-600 hover:bg-amber-50',
  danger: 'border-rose-200 text-rose-600 hover:bg-rose-50',
}
function IconBtn({ title, onClick, icon, tone = 'slate' }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${TONES[tone]}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{icon}</svg>
    </button>
  )
}

export default function InventoryPage({
  title = 'Property Inventory',
  subtitle = 'Manage builders, projects, inventory, unit availability, reservations, bookings, and property lifecycle.',
  basePath = '/admin/inventory',
  bookingsPath = '/admin/bookings',
}) {
  // Active tab is reflected in the URL (?tab=directory) so deep-links and the
  // "Back" from a project/builder detail page land on the right tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'directory' ? 'directory' : 'units'
  const switchTab = (t) => setSearchParams(t === 'directory' ? { tab: 'directory' } : {}, { replace: true })
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === 'units'} onClick={() => switchTab('units')}>Inventory Grid</TabButton>
        <TabButton active={tab === 'directory'} onClick={() => switchTab('directory')}>Builders &amp; Projects</TabButton>
      </div>
      {tab === 'units' ? <UnitsTab basePath={basePath} bookingsPath={bookingsPath} onGoDirectory={() => switchTab('directory')} /> : <DirectoryTab basePath={basePath} />}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    }`}>{children}</button>
  )
}

// ---------------- Tab 1 · Inventory grid ----------------
const EMPTY_ADV = { propertyType: '', configuration: '', tower: '', floor: '', priceMin: '', priceMax: '', areaMin: '', areaMax: '', availability: '', bookingStatus: '', assignedExec: '' }

function UnitsTab({ basePath = '/admin/inventory', bookingsPath = '/admin/bookings', onGoDirectory }) {
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [builder, setBuilder] = useState('')
  const [project, setProject] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [adv, setAdv] = useState(EMPTY_ADV)
  const [showAdv, setShowAdv] = useState(false)
  const [lockFor, setLockFor] = useState(null)
  const [editFor, setEditFor] = useState(null)
  const [transferFor, setTransferFor] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const { data: stats } = useFetch(useCallback(() => unitsApi.stats(), []))
  const { data: builders } = useFetch(useCallback(() => buildersApi.list({ limit: 100 }), []))
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 100 }), []))
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', limit: 100 }), []))
  const query = useMemo(() => ({ project, status, search, limit: 300, ...Object.fromEntries(Object.entries(adv).filter(([, v]) => v !== '')) }), [project, status, search, adv])
  const { data, loading, error, refetch } = useFetch(useCallback(() => unitsApi.list(query), [query]))

  const projectOptions = (projects || []).filter((p) => !builder || (p.builder?._id || p.builder) === builder)
  const setA = (k) => (e) => setAdv((f) => ({ ...f, [k]: e.target.value }))

  async function release(u) {
    try { await unitsApi.release(u._id); toast.success('Unit released'); refetch() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const columns = [
    { key: 'unitNumber', header: 'Unit / Project', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.unitNumber}</div><div className="text-xs text-slate-500">{r.project?.name || '—'}</div></div>
    ) },
    { key: 'propertyType', header: 'Type', render: (r) => titleCase(r.propertyType) || '—' },
    { key: 'config', header: 'Config', render: (r) => r.configuration || r.unitType || '—' },
    { key: 'tower', header: 'Tower/Floor', render: (r) => [r.tower, r.floor].filter(Boolean).join(' · ') || '—' },
    { key: 'parking', header: 'Parking', render: (r) => r.parking || '—' },
    { key: 'areaSqft', header: 'Area', render: (r) => r.areaSqft ? `${r.areaSqft} sqft` : '—' },
    { key: 'price', header: 'Price', render: (r) => formatMoney(r.currentPrice ?? r.basePrice ?? r.price) },
    { key: 'customer', header: 'Customer', render: (r) => r.customerName || '—' },
    { key: 'exec', header: 'Sales Exec', render: (r) => r.salesExecutive || '—' },
    { key: 'bookingDate', header: 'Booking Date', render: (r) => r.bookingDate ? formatDate(r.bookingDate) : '—' },
    { key: 'status', header: 'Status', render: (r) => (
      <div>
        <StatusBadge status={r.status} />
        {r.status === 'locked' && <div className="mt-1 text-[11px] text-amber-700">until {formatDate(r.lockedUntil, true)}</div>}
      </div>
    ) },
    { key: 'updated', header: 'Last Updated', render: (r) => formatDate(r.updatedAt) },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <IconBtn title="View" icon={ICONS.eye} onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/units/${r._id}`) }} />
        {can('unit', 'edit') && <IconBtn title="Edit" icon={ICONS.pencil} onClick={(e) => { e.stopPropagation(); setEditFor(r) }} />}
        {can('unit', 'edit') && r.status === 'available' && <IconBtn title="Lock" icon={ICONS.lock} tone="amber" onClick={(e) => { e.stopPropagation(); setLockFor(r) }} />}
        {can('unit', 'edit') && ['locked', 'reserved', 'token', 'hold'].includes(r.status) && <IconBtn title="Transfer" icon={ICONS.transfer} onClick={(e) => { e.stopPropagation(); setTransferFor(r) }} />}
        {can('unit', 'edit') && r.status === 'locked' && <IconBtn title="Release" icon={ICONS.unlock} tone="danger" onClick={(e) => { e.stopPropagation(); release(r) }} />}
        {r.bookingId && <IconBtn title="Booking" icon={ICONS.doc} onClick={(e) => { e.stopPropagation(); navigate(bookingsPath) }} />}
      </div>
    ) },
  ]

  return (
    <div>
      {/* Primary CTA — add inventory (spec §Create Unit; permission-gated) */}
      {can('unit', 'create') && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <span className="mr-auto text-sm text-slate-500">{(data || []).length} unit{(data || []).length === 1 ? '' : 's'} shown</span>
          <Button onClick={() => setShowAdd(true)}>+ Add Units</Button>
        </div>
      )}

      {/* KPI section (spec §Inventory Dashboard) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Units" value={stats?.totalProperties ?? '—'} />
        <StatCard label="Available" value={stats?.byStatus?.available ?? stats?.available ?? '—'} />
        <StatCard label="Reserved" value={stats?.byStatus?.reserved ?? '—'} />
        <StatCard label="Booked" value={stats?.byStatus?.booked ?? stats?.booked ?? '—'} />
        <StatCard label="Sold" value={stats?.byStatus?.sold ?? '—'} />
        <StatCard label="Hold" value={stats?.byStatus?.hold ?? '—'} />
        <StatCard label="Registered" value={stats?.byStatus?.registered ?? '—'} />
        <StatCard label="Possession" value={stats?.byStatus?.possession ?? '—'} />
        <StatCard label="Blocked" value={stats?.byStatus?.blocked ?? '—'} />
      </div>

      {/* Base filters (kept) */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Builder" value={builder} onChange={(e) => { setBuilder(e.target.value); setProject('') }}>
          <option value="">All builders</option>
          {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projectOptions.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </Select>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['available', 'token', 'hold', 'locked', 'reserved', 'booked', 'sold', 'registered', 'possession', 'blocked'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Input label="Search unit #" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. A-101" />
      </div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => setShowAdv((v) => !v)}>{showAdv ? 'Hide additional filters' : 'Additional filters'}</Button>
      </div>

      {showAdv && (
        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Property type" value={adv.propertyType} onChange={setA('propertyType')} placeholder="apartment / villa…" />
            <Input label="Configuration" value={adv.configuration} onChange={setA('configuration')} placeholder="2BHK…" />
            <Input label="Tower / Wing" value={adv.tower} onChange={setA('tower')} />
            <Input label="Floor" value={adv.floor} onChange={setA('floor')} />
            <Input label="Price min (₹)" type="number" value={adv.priceMin} onChange={setA('priceMin')} />
            <Input label="Price max (₹)" type="number" value={adv.priceMax} onChange={setA('priceMax')} />
            <Input label="Area min (sqft)" type="number" value={adv.areaMin} onChange={setA('areaMin')} />
            <Input label="Area max (sqft)" type="number" value={adv.areaMax} onChange={setA('areaMax')} />
            <Select label="Availability" value={adv.availability} onChange={setA('availability')}>
              <option value="">Any</option>
              {['available', 'token', 'hold', 'locked', 'reserved', 'booked', 'sold', 'registered', 'possession', 'blocked'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
            <Select label="Booking status" value={adv.bookingStatus} onChange={setA('bookingStatus')}>
              <option value="">Any</option>
              <option value="booked">Booked</option>
              <option value="reserved">Reserved</option>
            </Select>
            <Select label="Assigned sales exec" value={adv.assignedExec} onChange={setA('assignedExec')}>
              <option value="">Any</option>
              {(execs || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </Select>
            <div className="flex items-end"><Button variant="ghost" onClick={() => setAdv(EMPTY_ADV)}>Clear All</Button></div>
          </div>
        </Card>
      )}

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (data || []).length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 text-4xl">▦</div>
          {(projects || []).length === 0 ? (
            <>
              <div className="text-sm font-medium text-slate-700">No inventory yet</div>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Add a builder and register a project first, then add its units.</p>
              <Button variant="secondary" className="mt-4" onClick={() => onGoDirectory?.()}>Go to Builders &amp; Projects</Button>
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-700">No units match these filters</div>
              {can('unit', 'create') && <Button className="mt-4" onClick={() => setShowAdd(true)}>+ Add Units</Button>}
            </>
          )}
        </Card>
      ) : (
        <Table columns={columns} rows={data || []} empty="No units match these filters" onRowClick={(r) => navigate(`${basePath}/units/${r._id}`)} />
      )}

      {showAdd && <AddUnitsModal projects={projects || []} builders={builders || []} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refetch() }} />}
      {lockFor && <LockModal unit={lockFor} onClose={() => setLockFor(null)} onDone={() => { setLockFor(null); refetch() }} />}
      {editFor && <UnitEditModal unit={editFor} builders={builders || []} projects={projects || []} onClose={() => setEditFor(null)} onDone={() => { setEditFor(null); refetch() }} />}
      {transferFor && <TransferUnitModal unit={transferFor} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch() }} />}
    </div>
  )
}

// Parking options (spec: separate two-wheeler / four-wheeler selection).
const TWO_WHEELER_OPTS = ['None', '1', '2', '3+']
const FOUR_WHEELER_OPTS = ['None', '1 Covered', '1 Open', '2 Covered', '2 Open']
function parkingSummary(tw, fw) {
  const parts = []
  if (tw && tw !== 'None') parts.push(`2W ${tw}`)
  if (fw && fw !== 'None') parts.push(`4W ${fw}`)
  return parts.join(' · ') || 'None'
}

// Add inventory — a single unit or a bulk grid (tower × floors × units) into a
// project (spec §Create Unit). Uses unitsApi.create / unitsApi.bulk. Pass
// `fixedProjectId` to lock it to one project (e.g. from a project detail page).
export function AddUnitsModal({ projects = [], builders = [], fixedProjectId, fixedProjectName, onClose, onDone }) {
  const toast = useToast()
  const [mode, setMode] = useState('single')
  const [builder, setBuilder] = useState('')
  const [project, setProject] = useState(fixedProjectId || '')
  const [busy, setBusy] = useState(false)
  const projectOptions = (projects || []).filter((p) => !builder || (p.builder?._id || p.builder) === builder)

  const [single, setSingle] = useState({ unitNumber: '', configuration: '', propertyType: 'apartment', tower: '', floor: '', facing: '', twoWheeler: 'None', fourWheeler: 'None', areaSqft: '', basePrice: '' })
  const setS = (k) => (e) => setSingle((f) => ({ ...f, [k]: e.target.value }))

  const [bulk, setBulk] = useState({ tower: 'A', startFloor: '1', floors: '5', perFloor: '4', configuration: '2 BHK', propertyType: 'apartment', areaSqft: '', basePrice: '', facing: '', twoWheeler: 'None', fourWheeler: 'None' })
  const setB = (k) => (e) => setBulk((f) => ({ ...f, [k]: e.target.value }))

  const preview = useMemo(() => {
    if (mode !== 'bulk') return []
    const out = []
    const sf = Number(bulk.startFloor) || 1, fl = Number(bulk.floors) || 0, pf = Number(bulk.perFloor) || 0
    for (let f = sf; f < sf + fl; f++) for (let u = 1; u <= pf; u++) out.push(`${bulk.tower}-${f}${String(u).padStart(2, '0')}`)
    return out
  }, [mode, bulk])

  async function save() {
    if (!project) { toast.error('Select a project'); return }
    setBusy(true)
    try {
      if (mode === 'single') {
        if (!single.unitNumber.trim()) { toast.error('Unit number is required'); setBusy(false); return }
        await unitsApi.create({
          project, unitNumber: single.unitNumber.trim(), configuration: single.configuration || undefined,
          unitType: single.configuration || undefined, propertyType: single.propertyType || undefined,
          tower: single.tower || undefined, floor: single.floor || undefined, facing: single.facing || undefined,
          twoWheelerParking: single.twoWheeler, fourWheelerParking: single.fourWheeler, parking: parkingSummary(single.twoWheeler, single.fourWheeler),
          areaSqft: single.areaSqft ? Number(single.areaSqft) : undefined,
          basePrice: single.basePrice ? Number(single.basePrice) : undefined, currentPrice: single.basePrice ? Number(single.basePrice) : undefined,
        })
        toast.success('Unit added')
      } else {
        if (!preview.length) { toast.error('Set tower, floors and units per floor'); setBusy(false); return }
        const price = bulk.basePrice ? Number(bulk.basePrice) : undefined
        const units = []
        const sf = Number(bulk.startFloor) || 1
        for (let f = sf; f < sf + (Number(bulk.floors) || 0); f++) {
          for (let u = 1; u <= (Number(bulk.perFloor) || 0); u++) {
            units.push({
              unitNumber: `${bulk.tower}-${f}${String(u).padStart(2, '0')}`, tower: bulk.tower, floor: String(f),
              configuration: bulk.configuration || undefined, unitType: bulk.configuration || undefined, propertyType: bulk.propertyType || undefined,
              facing: bulk.facing || undefined, twoWheelerParking: bulk.twoWheeler, fourWheelerParking: bulk.fourWheeler, parking: parkingSummary(bulk.twoWheeler, bulk.fourWheeler),
              areaSqft: bulk.areaSqft ? Number(bulk.areaSqft) : undefined,
              basePrice: price, currentPrice: price,
            })
          }
        }
        const res = await unitsApi.bulk({ project, units })
        toast.success(res.data?.message || `${units.length} units added`)
      }
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add units')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title="Add Units"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !project}>{mode === 'single' ? 'Add Unit' : `Add ${preview.length || ''} Units`}</Button></>}
    >
      {!fixedProjectId && (projects || []).length === 0 ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need a project first. Go to the <strong>Builders &amp; Projects</strong> tab, onboard a builder, then register a project — after that you can add its units here.
        </div>
      ) : (
        <div className="space-y-4">
          {fixedProjectId ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Adding units to <strong className="text-slate-900">{fixedProjectName || 'this project'}</strong></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Builder (filter)" value={builder} onChange={(e) => { setBuilder(e.target.value); setProject('') }}>
                <option value="">All builders</option>
                {(builders || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </Select>
              <Select label="Project *" value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Select a project…</option>
                {projectOptions.map((p) => <option key={p._id} value={p._id}>{p.name}{p.builder?.name ? ` · ${p.builder.name}` : ''}</option>)}
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            {[['single', 'Single Unit'], ['bulk', 'Bulk (grid)']].map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === v ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{l}</button>
            ))}
          </div>

          {mode === 'single' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Unit Number *" value={single.unitNumber} onChange={setS('unitNumber')} placeholder="A-101" />
              <Input label="Configuration" value={single.configuration} onChange={setS('configuration')} placeholder="2 BHK" />
              <Input label="Property Type" value={single.propertyType} onChange={setS('propertyType')} placeholder="apartment / villa / plot" />
              <Input label="Tower / Wing" value={single.tower} onChange={setS('tower')} />
              <Input label="Floor" value={single.floor} onChange={setS('floor')} />
              <Input label="Facing" value={single.facing} onChange={setS('facing')} placeholder="E / W / N / S" />
              <Select label="Two-Wheeler Parking" value={single.twoWheeler} onChange={setS('twoWheeler')}>
                {TWO_WHEELER_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
              <Select label="Four-Wheeler Parking" value={single.fourWheeler} onChange={setS('fourWheeler')}>
                {FOUR_WHEELER_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
              <Input label="Area (sqft)" type="number" value={single.areaSqft} onChange={setS('areaSqft')} />
              <Input label="Price (₹)" type="number" value={single.basePrice} onChange={setS('basePrice')} />
            </div>
          ) : (
            <div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Tower / Wing" value={bulk.tower} onChange={setB('tower')} />
                <Input label="Start floor" type="number" value={bulk.startFloor} onChange={setB('startFloor')} />
                <Input label="Number of floors" type="number" value={bulk.floors} onChange={setB('floors')} />
                <Input label="Units per floor" type="number" value={bulk.perFloor} onChange={setB('perFloor')} />
                <Input label="Configuration" value={bulk.configuration} onChange={setB('configuration')} placeholder="2 BHK" />
                <Input label="Property Type" value={bulk.propertyType} onChange={setB('propertyType')} />
                <Input label="Area (sqft)" type="number" value={bulk.areaSqft} onChange={setB('areaSqft')} />
                <Input label="Price (₹)" type="number" value={bulk.basePrice} onChange={setB('basePrice')} />
                <Input label="Facing" value={bulk.facing} onChange={setB('facing')} />
                <Select label="Two-Wheeler Parking" value={bulk.twoWheeler} onChange={setB('twoWheeler')}>
                  {TWO_WHEELER_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Select label="Four-Wheeler Parking" value={bulk.fourWheeler} onChange={setB('fourWheeler')}>
                  {FOUR_WHEELER_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </Select>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Generates <strong>{preview.length}</strong> unit{preview.length === 1 ? '' : 's'}{preview.length ? `: ${preview.slice(0, 6).join(', ')}${preview.length > 6 ? '…' : ''}` : ''}. Duplicate unit numbers in the project are skipped.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// Transfer a held/reserved unit's holding to another available unit in the same
// project, before booking confirmation (spec §Unit Transfer).
function TransferUnitModal({ unit, onClose, onDone }) {
  const toast = useToast()
  const projectId = unit.project?._id || unit.project
  const { data: available } = useFetch(useCallback(() => unitsApi.list({ project: projectId, status: 'available', limit: 300 }), [projectId]))
  const [newUnit, setNewUnit] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await unitsApi.transfer(unit._id, { newUnit, reason })
      toast.success('Unit transferred')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Transfer Unit ${unit.unitNumber}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !newUnit || reason.trim().length < 2}>Confirm Transfer</Button>
      </>
    }>
      <p className="mb-3 text-sm text-slate-600">Moves the current holding ({titleCase(unit.status)}) and its customer to a new available unit. Only allowed before booking confirmation. Transfer history is preserved.</p>
      <div className="space-y-4">
        <Select label="New Unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
          <option value="">Select an available unit…</option>
          {(available || []).filter((u) => u._id !== unit._id).map((u) => <option key={u._id} value={u._id}>{u.unitNumber}{u.tower ? ` · ${u.tower}` : ''}{u.floor ? ` · Fl ${u.floor}` : ''}</option>)}
        </Select>
        <Input label="Transfer Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the unit being changed?" />
      </div>
    </Modal>
  )
}

function UnitEditModal({ unit, builders = [], projects = [], onClose, onDone }) {
  const toast = useToast()
  const currentProjectId = String(unit.project?._id || unit.project || '')
  const currentBuilderId = String(unit.project?.builder?._id || unit.project?.builder || (projects.find((p) => String(p._id) === currentProjectId)?.builder?._id) || (projects.find((p) => String(p._id) === currentProjectId)?.builder) || '')
  const [form, setForm] = useState({
    builder: currentBuilderId, project: currentProjectId,
    propertyType: unit.propertyType || '', configuration: unit.configuration || unit.unitType || '',
    tower: unit.tower || '', floor: unit.floor || '', facing: unit.facing || '', parking: unit.parking || '',
    areaSqft: unit.areaSqft || '', basePrice: unit.basePrice ?? unit.price ?? '', currentPrice: unit.currentPrice ?? '', discount: unit.discount || 0,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const canMove = unit.status === 'available' // backend rule: only available units can change project

  const projectOptions = projects.filter((p) => !form.builder || String(p.builder?._id || p.builder) === form.builder)
  const onBuilderChange = (e) => {
    const b = e.target.value
    const opts = projects.filter((p) => !b || String(p.builder?._id || p.builder) === b)
    setForm((f) => ({ ...f, builder: b, project: opts.some((p) => String(p._id) === f.project) ? f.project : (opts[0]?._id || '') }))
  }

  async function save() {
    setBusy(true)
    try {
      await unitsApi.update(unit._id, {
        project: form.project || undefined,
        propertyType: form.propertyType, configuration: form.configuration, tower: form.tower, floor: form.floor,
        facing: form.facing, parking: form.parking, areaSqft: Number(form.areaSqft) || undefined,
        basePrice: Number(form.basePrice) || undefined, currentPrice: Number(form.currentPrice) || undefined, discount: Number(form.discount) || 0,
      })
      toast.success('Unit updated'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={`Edit ${unit.unitNumber}`} footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !form.project}>Save</Button></>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Builder" value={form.builder} onChange={onBuilderChange} disabled={!canMove}>
          <option value="">All builders</option>
          {builders.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Select label="Project" value={form.project} onChange={set('project')} disabled={!canMove}>
          <option value="">Select a project…</option>
          {projectOptions.map((p) => <option key={p._id} value={p._id}>{p.name}{p.builder?.name ? ` · ${p.builder.name}` : ''}</option>)}
        </Select>
        {!canMove && <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Builder / project can only be changed for an <strong>available</strong> unit (this one is {titleCase(unit.status)}).</p>}
        <Input label="Property type" value={form.propertyType} onChange={set('propertyType')} />
        <Input label="Configuration" value={form.configuration} onChange={set('configuration')} />
        <Input label="Tower / Wing" value={form.tower} onChange={set('tower')} />
        <Input label="Floor" value={form.floor} onChange={set('floor')} />
        <Input label="Facing" value={form.facing} onChange={set('facing')} />
        <Input label="Parking" value={form.parking} onChange={set('parking')} />
        <Input label="Area (sqft)" type="number" value={form.areaSqft} onChange={set('areaSqft')} />
        <Input label="Base price (₹)" type="number" value={form.basePrice} onChange={set('basePrice')} />
        <Input label="Current price (₹)" type="number" value={form.currentPrice} onChange={set('currentPrice')} />
        <Input label="Discount (%)" type="number" value={form.discount} onChange={set('discount')} />
      </div>
    </Modal>
  )
}

function LockModal({ unit, onClose, onDone }) {
  const toast = useToast()
  const { data: customers } = useFetch(useCallback(() => customersApi.list({ limit: 100 }), []))
  const [customer, setCustomer] = useState('')
  const [reason, setReason] = useState('')
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await unitsApi.lock(unit._id, { customer, reason, hours: hours ? Number(hours) : undefined })
      toast.success('Unit locked'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Lock ${unit.unitNumber}`} footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !customer || reason.trim().length < 3}>Lock Unit</Button></>
    }>
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Locks this unit across the firm and blocks booking until it expires (default 48h) or is released.</p>
        <Select label="Hold for lead" value={customer} onChange={(e) => setCustomer(e.target.value)}>
          <option value="">Select a lead…</option>
          {(customers || []).map((c) => <option key={c._id} value={c._id}>{c.name} · {c.mobile}</option>)}
        </Select>
        <Textarea label="Lock reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Token received, holding for KYC verification." />
        <Input label="Lock window (hours) — optional" type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Defaults to firm setting (48h)" />
      </div>
    </Modal>
  )
}

// ---------------- Tab 2 · Builders & Projects ----------------
function DirectoryTab({ basePath = '/admin/inventory' }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [builderModal, setBuilderModal] = useState(null) // {} new | builder edit
  const [projectModal, setProjectModal] = useState(null)
  const { data: builders, refetch: refetchB } = useFetch(useCallback(() => buildersApi.list({ limit: 100 }), []))
  const { data: projects, refetch: refetchP } = useFetch(useCallback(() => projectsApi.list({ limit: 100 }), []))

  const kpis = useMemo(() => {
    const ps = projects || []
    return {
      builders: (builders || []).length,
      projects: ps.length,
      active: ps.filter((p) => !p.isArchived && p.status !== 'archived').length,
      ready: ps.filter((p) => p.constructionStatus === 'ready_to_move').length,
    }
  }, [builders, projects])

  async function deactivateBuilder(b) {
    if (!window.confirm(`Deactivate "${b.name}"? Its projects become read-only.`)) return
    try { await buildersApi.archive(b._id); refetchB(); refetchP() } catch { /* toast handled below */ }
  }

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Builders" value={kpis.builders} />
        <StatCard label="Total Projects" value={kpis.projects} />
        <StatCard label="Active Projects" value={kpis.active} />
        <StatCard label="Ready To Move" value={kpis.ready} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Builders */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Builders</h3>
            {can('builder', 'create') && <Button size="sm" onClick={() => setBuilderModal({})}>+ Onboard Builder</Button>}
          </div>
          <div className="space-y-3">
            {(builders || []).length === 0 && <p className="text-sm text-slate-400">No builders yet.</p>}
            {(builders || []).map((b) => (
              <Card key={b._id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">{(b.name || '?').slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="font-medium text-slate-900">{b.name}</div>
                      <div className="text-xs text-slate-500">{b.contactPerson || 'No contact'} · {b.city || '—'}</div>
                    </div>
                  </div>
                  <StatusBadge status={b.isArchived ? 'cancelled' : (b.complianceStatus || 'compliant')} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-slate-500">
                  <span>Mobile: {b.phone || '—'}</span>
                  <span>RERA exp: {b.reraExpiry ? formatDate(b.reraExpiry) : '—'}</span>
                  <span>Email: {b.email || '—'}</span>
                  <span>Commission: {b.commissionAgreement || '—'}</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <IconBtn title="View" icon={ICONS.eye} onClick={() => navigate(`${basePath}/builders/${b._id}`)} />
                  {can('builder', 'edit') && <IconBtn title="Edit" icon={ICONS.pencil} onClick={() => setBuilderModal(b)} />}
                  {can('builder', 'delete') && !b.isArchived && <IconBtn title="Deactivate" icon={ICONS.power} tone="danger" onClick={() => deactivateBuilder(b)} />}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Projects</h3>
            {can('project', 'create') && <Button size="sm" onClick={() => setProjectModal({})}>+ Register Project</Button>}
          </div>
          <div className="space-y-3">
            {(projects || []).length === 0 && <p className="text-sm text-slate-400">No projects yet.</p>}
            {(projects || []).map((p) => (
              <Card key={p._id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.builder?.name || '—'} · {p.location || p.city || '—'}</div>
                  </div>
                  <StatusBadge status={p.constructionStatus || 'under_construction'} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-slate-500">
                  <span>Type: {titleCase(p.propertyType) || '—'}</span>
                  <span>RERA: {p.reraNumber || '—'}</span>
                  <span>Commission: {p.commissionRate || 0}%</span>
                  <span>Possession: {p.possessionDate ? formatDate(p.possessionDate) : '—'}</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <IconBtn title="View" icon={ICONS.eye} onClick={() => navigate(`${basePath}/projects/${p._id}`)} />
                  {can('project', 'edit') && <IconBtn title="Edit" icon={ICONS.pencil} onClick={() => setProjectModal(p)} />}
                  <IconBtn title="Manage Inventory" icon={ICONS.grid} onClick={() => navigate(`${basePath}/projects/${p._id}`)} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {builderModal && <BuilderModal builder={builderModal} onClose={() => setBuilderModal(null)} onDone={() => { setBuilderModal(null); refetchB() }} />}
      {projectModal && <ProjectModal project={projectModal} builders={builders || []} onClose={() => setProjectModal(null)} onDone={() => { setProjectModal(null); refetchP() }} />}
    </div>
  )
}

function BuilderModal({ builder, onClose, onDone }) {
  const toast = useToast()
  const isNew = !builder._id
  const [form, setForm] = useState({
    name: builder.name || '', reraCert: builder.reraCert || '', contactPerson: builder.contactPerson || '',
    phone: builder.phone || '', email: builder.email || '', city: builder.city || '', gstNumber: builder.gstNumber || '',
    address: builder.address || '', commissionAgreement: builder.commissionAgreement || '',
    reraExpiry: builder.reraExpiry ? String(builder.reraExpiry).slice(0, 10) : '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      const payload = { ...form, reraExpiry: form.reraExpiry || undefined }
      if (isNew) await buildersApi.create(payload); else await buildersApi.update(builder._id, payload)
      toast.success(isNew ? 'Builder onboarded' : 'Builder updated'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Onboard Builder' : `Edit ${builder.name}`} footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || form.name.trim().length < 2}>{isNew ? 'Onboard' : 'Save'}</Button></>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Legal builder name" value={form.name} onChange={set('name')} />
        <Input label="Contact person" value={form.contactPerson} onChange={set('contactPerson')} />
        <Input label="Mobile" value={form.phone} onChange={set('phone')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="City" value={form.city} onChange={set('city')} />
        <Input label="GST number" value={form.gstNumber} onChange={set('gstNumber')} />
        <Input label="RERA certificate" value={form.reraCert} onChange={set('reraCert')} placeholder="MHARERA-BLD90291" />
        <Input label="RERA expiry" type="date" value={form.reraExpiry} onChange={set('reraExpiry')} />
        <div className="sm:col-span-2"><Input label="Office address" value={form.address} onChange={set('address')} /></div>
        <div className="sm:col-span-2"><Input label="Commission agreement" value={form.commissionAgreement} onChange={set('commissionAgreement')} placeholder="e.g. 2.5% flat + accelerators" /></div>
      </div>
    </Modal>
  )
}

function ProjectModal({ project, builders, onClose, onDone }) {
  const toast = useToast()
  const isNew = !project._id
  const [form, setForm] = useState({
    name: project.name || '', builder: project.builder?._id || project.builder || '', location: project.location || '',
    reraNumber: project.reraNumber || '', commissionRate: project.commissionRate || '', propertyType: project.propertyType || '',
    constructionStatus: project.constructionStatus || 'under_construction',
    launchDate: project.launchDate ? String(project.launchDate).slice(0, 10) : '',
    possessionDate: project.possessionDate ? String(project.possessionDate).slice(0, 10) : '',
    amenities: (project.amenities || []).join(', '),
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      const payload = {
        name: form.name, builder: form.builder, location: form.location, reraNumber: form.reraNumber,
        commissionRate: form.commissionRate ? Number(form.commissionRate) : undefined, propertyType: form.propertyType,
        constructionStatus: form.constructionStatus, launchDate: form.launchDate || undefined, possessionDate: form.possessionDate || undefined,
        amenities: form.amenities ? form.amenities.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      }
      if (isNew) await projectsApi.create(payload); else await projectsApi.update(project._id, payload)
      toast.success(isNew ? 'Project registered' : 'Project updated'); onDone()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'Register Project' : `Edit ${project.name}`} footer={
      <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !form.name || !form.builder}>{isNew ? 'Register' : 'Save'}</Button></>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Project name" value={form.name} onChange={set('name')} />
        <Select label="Builder" value={form.builder} onChange={set('builder')}>
          <option value="">Select builder…</option>
          {builders.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
        <Input label="Location" value={form.location} onChange={set('location')} />
        <Input label="Property type" value={form.propertyType} onChange={set('propertyType')} placeholder="apartment / villa / plot" />
        <Input label="RERA number" value={form.reraNumber} onChange={set('reraNumber')} />
        <Input label="Commission rate (%)" type="number" value={form.commissionRate} onChange={set('commissionRate')} placeholder="2.5" />
        <Input label="Launch date" type="date" value={form.launchDate} onChange={set('launchDate')} />
        <Input label="Possession date" type="date" value={form.possessionDate} onChange={set('possessionDate')} />
        <Select label="Construction status" value={form.constructionStatus} onChange={set('constructionStatus')}>
          <option value="pre_launch">Pre-Launch</option>
          <option value="under_construction">Under Construction</option>
          <option value="ready_to_move">Ready to Move</option>
        </Select>
        <div className="sm:col-span-2"><Input label="Amenities (comma-separated)" value={form.amenities} onChange={set('amenities')} placeholder="Pool, Gym, Clubhouse" /></div>
      </div>
    </Modal>
  )
}
