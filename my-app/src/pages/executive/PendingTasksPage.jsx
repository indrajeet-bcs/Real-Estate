import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, PageHeader } from '../../components/ui.jsx'

const INITIAL_CATEGORIES = [
  {
    id: 'calls',
    title: "Today's Follow-up Calls",
    color: 'border-l-blue-500 bg-blue-50/30 text-blue-700',
    tasks: [
      { id: 'c1', text: 'Call Rohit Patel (Marina Bay) - High Priority', done: false, date: 'Today, 4 Jul', time: '9:30 AM' },
      { id: 'c2', text: 'Follow up on pricing with Sneha R. (Skyline Vista)', done: false, date: 'Today, 4 Jul', time: '11:00 AM' },
      { id: 'c3', text: 'Send floor plans to Vikram S. (Eden Gardens)', done: false, date: 'Today, 4 Jul', time: '2:00 PM' },
      { id: 'c4', text: 'Call Amit Shah (Park Plaza) - High Priority', done: false, date: 'Today, 4 Jul', time: '4:30 PM' },
      { id: 'c5', text: 'Reschedule discussion with Neha D.', done: false, date: 'Today, 4 Jul', time: '6:00 PM' },
    ]
  },
  {
    id: 'visits',
    title: 'Pending Site Visits',
    color: 'border-l-indigo-500 bg-indigo-50/30 text-indigo-700',
    tasks: [
      { id: 'v1', text: 'Arrange cab for Verma family (Bandra East)', done: false, date: 'Today, 4 Jul', time: '3:00 PM' },
      { id: 'v2', text: 'Confirm keys for Unit 1204 - Gupta family', done: false, date: 'Today, 4 Jul', time: '5:30 PM' },
    ]
  },
  {
    id: 'docs',
    title: 'Pending Document Collection',
    color: 'border-l-emerald-500 bg-emerald-50/30 text-emerald-700',
    tasks: [
      { id: 'd1', text: 'Collect PAN card copy - Rajiv Malhotra', done: false, date: 'Tomorrow, 5 Jul', time: '10:00 AM' },
      { id: 'd2', text: 'Aadhaar Card Verification - Deepa Sen', done: false, date: 'Tomorrow, 5 Jul', time: '12:30 PM' },
      { id: 'd3', text: 'Income Statement / Salary slip - Karan Johar', done: false, date: 'Monday, 6 Jul', time: '11:30 AM' },
    ]
  },
  {
    id: 'payments',
    title: 'Payment Reminders',
    color: 'border-l-amber-500 bg-amber-50/30 text-amber-700',
    tasks: [
      { id: 'p1', text: 'Follow up on Token Amount balance (Rs. 1,00,000) - Alok Kumar', done: false, date: 'Today, 4 Jul', time: '1:00 PM' },
    ]
  },
  {
    id: 'callbacks',
    title: 'Customer Callbacks',
    color: 'border-l-purple-500 bg-purple-50/30 text-purple-700',
    tasks: [
      { id: 'cb1', text: 'Callback requested from website query - Tushar Kapoor', done: false, date: 'Today, 4 Jul', time: '12:00 PM' },
      { id: 'cb2', text: 'Callback: Return call regarding housing loan options - Riya Sharma', done: false, date: 'Today, 4 Jul', time: '3:30 PM' },
      { id: 'cb3', text: 'Callback: Return call regarding builder reputation - Manoj Tiwary', done: false, date: 'Today, 4 Jul', time: '4:00 PM' },
      { id: 'cb4', text: 'Callback: Requesting area detail brochure - Sonal Varma', done: false, date: 'Today, 4 Jul', time: '5:00 PM' },
    ]
  },
  {
    id: 'admin',
    title: 'Admin Assigned Tasks',
    color: 'border-l-teal-500 bg-teal-50/30 text-teal-700',
    tasks: [
      { id: 'a1', text: 'Verify lead source tracking details - Admin request', done: false, date: 'Monday, 6 Jul', time: '9:00 AM' },
      { id: 'a2', text: 'Submit weekly attendance log summary - Admin request', done: false, date: 'Monday, 6 Jul', time: '5:00 PM' },
    ]
  },
  {
    id: 'overdue',
    title: 'Overdue Tasks',
    color: 'border-l-rose-500 bg-rose-50/30 text-rose-700',
    tasks: [
      { id: 'o1', text: '[Overdue 2 days] Call back Manish Jain (No response yesterday)', done: false, date: 'Yesterday, 3 Jul', time: '11:00 AM' },
      { id: 'o2', text: '[Overdue 1 day] Send formal quote to Kiara Advani', done: false, date: 'Yesterday, 3 Jul', time: '4:00 PM' },
      { id: 'o3', text: '[Overdue 3 days] Update CRM status for lost lead Rohan', done: false, date: '2 Jul', time: '10:30 AM' },
    ]
  }
]

export default function PendingTasksPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState(INITIAL_CATEGORIES)
  const [activeTab, setActiveTab] = useState('all')

  const toggleTask = (catId, taskId) => {
    setCategories(prev =>
      prev.map(cat => {
        if (cat.id !== catId) return cat
        return {
          ...cat,
          tasks: cat.tasks.map(t => {
            if (t.id !== taskId) return t
            return { ...t, done: !t.done }
          })
        }
      })
    )
  }

  const getPendingCount = (cat) => cat.tasks.filter(t => !t.done).length
  const getTotalPending = () => categories.reduce((acc, cat) => acc + getPendingCount(cat), 0)
  const getTotalTasks = () => categories.reduce((acc, cat) => acc + cat.tasks.length, 0)
  const getTotalCompleted = () => getTotalTasks() - getTotalPending()

  const progressPercent = getTotalTasks() > 0 ? Math.round((getTotalCompleted() / getTotalTasks()) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/executive')}>
          ← Back to Dashboard
        </Button>
      </div>

      <PageHeader
        title="Pending Tasks & Actions"
        subtitle="Operational action items requiring prompt attention"
      />

      {/* Progress & Stat Header */}
      <Card className="bg-gradient-to-r from-slate-900 to-blue-950 p-6 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Executive Task Tracker</h2>
            <p className="mt-1 text-sm text-slate-300">
              You have completed {getTotalCompleted()} out of {getTotalTasks()} tasks assigned to you.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-2xl font-bold tracking-tight">{getTotalPending()}</span>
              <span className="ml-1 text-xs uppercase tracking-wider text-slate-400">Remaining</span>
            </div>
            <div className="h-12 w-px bg-slate-700" />
            <div className="text-right">
              <span className="text-2xl font-bold tracking-tight text-emerald-400">{progressPercent}%</span>
              <span className="ml-1 text-xs uppercase tracking-wider text-slate-400">Complete</span>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mt-6">
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Quick Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          All Categories ({getTotalPending()})
        </button>
        {categories.map(cat => {
          const count = getPendingCount(cat)
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {cat.title} ({count})
            </button>
          )
        })}
      </div>

      {/* Categories & Tasks Lists */}
      <div className="space-y-6">
        {categories
          .filter(cat => activeTab === 'all' || cat.id === activeTab)
          .map(cat => {
            const pendingCount = getPendingCount(cat)
            return (
              <Card key={cat.id} className="overflow-hidden border-l-4 border-l-solid shadow-sm transition hover:shadow-md">
                <div className={`flex items-center justify-between border-b border-slate-100 px-5 py-4 ${cat.color.split(' ')[1]}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cat.color.split(' ')[0].replace('border-l', 'bg')}`} />
                    <h3 className="font-semibold text-slate-800">{cat.title}</h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cat.color.split(' ')[0].replace('border-l', 'bg').replace('-500', '-100')} ${cat.color.split(' ')[2]}`}>
                    {pendingCount} Pending
                  </span>
                </div>

                <div className="divide-y divide-slate-100 px-5 py-2">
                  {cat.tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 py-3.5 transition hover:bg-slate-50/50 ${
                        task.done ? 'opacity-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(cat.id, task.id)}
                        className="mt-1 h-4.5 w-4.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className={`text-sm text-slate-700 ${task.done ? 'line-through decoration-slate-400' : ''}`}>
                          {task.text}
                        </p>
                        {(task.date || task.time) && (
                          <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded shadow-sm">
                            {task.date && <span>📅 {task.date}</span>}
                            {task.date && task.time && <span className="text-slate-300">|</span>}
                            {task.time && <span>🕒 {task.time}</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {cat.tasks.length === 0 && (
                    <div className="py-6 text-center text-sm text-slate-500">
                      No tasks in this category
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
