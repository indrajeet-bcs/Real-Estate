import DashboardHome from '../../components/DashboardHome.jsx'

export default function ExecutiveDashboard() {
  return (
    <DashboardHome
      title="Executive Dashboard"
      subtitle="Assigned leads, today's tasks & overdue follow-ups (§6)"
      modules={[
        { icon: '☺', title: 'My Customers', desc: 'Assigned customers filtered by status.', to: '/executive/customers' },
        { icon: '↻', title: 'Follow-ups', desc: 'Schedule, complete, miss or reschedule.', to: '/executive/followups' },
        { icon: '⌖', title: 'Site Visits', desc: 'Create visits, capture outcomes and photos.', to: '/executive/visits' },
        { icon: '✓', title: 'Bookings', desc: 'Book units with double-booking prevention.', to: '/executive/bookings' },
        { icon: '◷', title: 'Attendance / Check-in', desc: 'Day start/end with GPS capture.', to: '/executive/attendance' },
      ]}
    />
  )
}
