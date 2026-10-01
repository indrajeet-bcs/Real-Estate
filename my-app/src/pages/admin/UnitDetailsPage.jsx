import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { unitsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { ROLES } from '../../lib/constants.js'
import { PageHeader, Card, StatCard, Button, Table, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'

function Section({ title, children, actions }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {actions}
      </div>
      {children}
    </Card>
  )
}
function Field({ label, value }) {
  return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="text-slate-700">{value ?? '—'}</dd></div>
}

const LIFECYCLE = ['Property added', 'Reserved', 'Locked', 'Booked', 'Registered', 'Sold']

export default function UnitDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const bookingsBase = user?.role === ROLES.SUB_ADMIN ? '/sub-admin/bookings' : user?.role === ROLES.SALES_EXECUTIVE ? '/executive/bookings' : '/admin/bookings'
  const { data, loading, error, refetch } = useFetch(useCallback(() => unitsApi.get(id), [id]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { unit, builder, pricing, booking, lock, timeline = [] } = data
  const doneLabels = new Set(timeline.filter((t) => t.done).map((t) => t.label))
  const transfers = unit.transferHistory || []

  return (
    <div>
      <div className="mb-4"><button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button></div>
      <PageHeader
        title={`Unit ${unit.unitNumber}`}
        subtitle={`${unit.project?.name || '—'} · ${builder?.name || '—'}`}
        actions={<StatusBadge status={unit.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Section title="Basic Information">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Unit Number" value={unit.unitNumber} />
            <Field label="Builder" value={builder?.name} />
            <Field label="Project" value={unit.project?.name} />
            <Field label="Property Type" value={titleCase(unit.propertyType)} />
            <Field label="Tower / Wing" value={unit.tower} />
            <Field label="Floor" value={unit.floor} />
            <Field label="Configuration" value={unit.configuration || unit.unitType} />
            <Field label="Area" value={unit.areaSqft ? `${unit.areaSqft} sqft` : '—'} />
            <Field label="Facing" value={unit.facing} />
            <Field label="Parking" value={unit.parking} />
          </dl>
        </Section>

        {/* Pricing */}
        <Section title="Pricing">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Base Price" value={formatMoney(pricing.basePrice)} />
            <StatCard label="Current Price" value={formatMoney(pricing.currentPrice)} />
            <StatCard label="Discount" value={`${pricing.discount}%`} />
            <StatCard label="Final Price" value={formatMoney(pricing.finalPrice)} />
          </div>
        </Section>
      </div>

      {/* Current status + booking / lock */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Booking Information">
          {booking ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Customer Name" value={booking.customerName} />
              <Field label="Sales Executive" value={booking.salesExecutive} />
              <Field label="Booking Date" value={formatDate(booking.bookingDate)} />
              <Field label="Registration Status" value={<StatusBadge status={booking.registrationStatus} />} />
              <div className="col-span-2 mt-1"><Button size="sm" variant="secondary" onClick={() => navigate(bookingsBase)}>View Booking</Button></div>
            </dl>
          ) : lock ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Locked By" value={lock.lockedByName} />
              <Field label="Held For" value={lock.lockedForName} />
              <Field label="Lock Expiry" value={formatDate(lock.lockedUntil, true)} />
              <Field label="Reason" value={lock.lockReason} />
            </dl>
          ) : <p className="text-sm text-slate-400">This unit has no booking or active lock.</p>}
        </Section>

        <Section title="Documents">
          <p className="text-sm text-slate-400">Floor Plan · Price Sheet · Agreement · RERA Document · Brochure</p>
          <p className="mt-2 text-xs text-slate-400">Document uploads for units are not yet enabled — coming with the document module.</p>
        </Section>
      </div>

      {/* Property timeline */}
      <div className="mt-6">
        <Section title="Property Timeline">
          <ol className="flex flex-wrap gap-2">
            {LIFECYCLE.map((stage) => {
              const done = doneLabels.has(stage) || (stage === 'Property added')
              return (
                <li key={stage} className={`rounded-full border px-3 py-1 text-xs ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {stage}
                </li>
              )
            })}
          </ol>
        </Section>
      </div>

      {/* Unit transfer history (spec §Unit Transfer / Unit History) */}
      {transfers.length > 0 && (
        <div className="mt-6">
          <Section title="Transfer History">
            <Table
              columns={[
                { key: 'at', header: 'Date & Time', render: (t) => formatDate(t.at, true) },
                { key: 'dir', header: 'Direction', render: (t) => t.direction === 'in' ? 'Received' : 'Released' },
                { key: 'from', header: 'From Unit', render: (t) => t.fromUnitNumber || '—' },
                { key: 'to', header: 'To Unit', render: (t) => t.toUnitNumber || '—' },
                { key: 'by', header: 'By', render: (t) => t.byName || '—' },
                { key: 'reason', header: 'Reason', render: (t) => t.reason || '—' },
              ]}
              rows={[...transfers].reverse()}
              empty="No transfers."
            />
          </Section>
        </div>
      )}
    </div>
  )
}
