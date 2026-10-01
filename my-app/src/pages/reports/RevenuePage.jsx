import { useCallback } from 'react'
import { reportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { PageHeader, Card, StatCard, Table, Loader } from '../../components/ui.jsx'

// Revenue overview (Admin & Super Admin, §8) — summary + booking trend.
export default function RevenuePage() {
  const { data: rev } = useFetch(useCallback(() => reportsApi.revenue(), []))
  const { data: trend, loading } = useFetch(useCallback(() => reportsApi.bookingTrend(), []))

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'bookings', header: 'Bookings' },
    { key: 'value', header: 'Value', render: (r) => formatMoney(r.value) },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Revenue Overview" subtitle="Firm revenue and booking trends (§8)" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Revenue" value={rev ? formatMoney(rev.totalRevenue) : '—'} />
        <StatCard label="Deal Value" value={rev ? formatMoney(rev.totalDealValue) : '—'} />
        <StatCard label="Confirmed Bookings" value={rev?.confirmedBookings} />
      </div>
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-medium text-slate-700">Booking Trend</h3>
        {loading ? <Loader /> : <Table columns={columns} rows={trend || []} empty="No bookings in range" />}
      </Card>
    </div>
  )
}
