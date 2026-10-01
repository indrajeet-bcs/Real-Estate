import { useState, useRef } from 'react'
import { PageHeader, Card, Button, Select, StatCard } from '../../components/ui.jsx'
import { formatMoney } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'

// --- Interactive Chart Toolkit ---

function ChartTooltip({ active, payload, x, y }) {
  if (!active || !payload) return null
  return (
    <div 
      className="absolute z-50 pointer-events-none rounded-md shadow-[0_4px_20px_rgb(0,0,0,0.1)] border border-slate-200 bg-white/95 backdrop-blur-md p-3 text-sm flex flex-col gap-1.5 transition-opacity duration-150 ease-out min-w-[120px]"
      style={{ left: x + 15, top: y + 15 }}
    >
      {payload.title && <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-1">{payload.title}</div>}
      {payload.lines.map((line, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {line.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: line.color }}></span>}
            <span className="text-slate-600 text-xs">{line.label}</span>
          </div>
          <span className="font-medium text-slate-900 text-xs">{line.value}</span>
        </div>
      ))}
    </div>
  )
}

function useChartTooltip() {
  const [tooltip, setTooltip] = useState({ active: false, x: 0, y: 0, payload: null })
  
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip(t => ({ ...t, x: e.clientX - rect.left, y: e.clientY - rect.top }))
  }
  const handleMouseLeave = () => setTooltip(t => ({ ...t, active: false, payload: null }))
  const setPayload = (payload) => setTooltip(t => ({ ...t, active: true, payload }))
  const clearPayload = () => setTooltip(t => ({ ...t, active: false, payload: null }))

  return { tooltip, handleMouseMove, handleMouseLeave, setPayload, clearPayload }
}

// --- Enhanced Chart Components ---

function BarChart({ data, color = 'bg-blue-500', colorHex = '#3b82f6', valuePrefix = '' }) {
  const max = Math.max(...data.map(d => d.value)) || 1
  const { tooltip, handleMouseMove, handleMouseLeave, setPayload, clearPayload } = useChartTooltip()
  const yLabels = [max, max * 0.75, max * 0.5, max * 0.25, 0].map(v => Math.round(v))

  return (
    <div 
      className="relative flex flex-col h-full min-h-[240px] w-full pt-4 select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none">
        {yLabels.map((val, i) => (
          <div key={i} className="flex items-center w-full h-0 relative">
            <span className="absolute -left-1 text-[10px] text-slate-400 -translate-x-full -translate-y-1/2 w-8 text-right pr-2">
              {val >= 1000 ? (val/1000).toFixed(1)+'k' : val}
            </span>
            <div className="w-full border-t border-slate-100 border-dashed"></div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex items-end gap-1.5 pl-10 pr-2 z-10 mt-2">
        {data.map((d, i) => (
          <div 
            key={i} 
            className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
            onMouseEnter={() => setPayload({
              title: d.label,
              lines: [
                { label: d.metricName || 'Count', value: `${valuePrefix}${d.value.toLocaleString()}`, color: d.colorHex || colorHex },
                ...(d.percentage ? [{ label: 'Percentage', value: d.percentage, color: '#94a3b8' }] : [])
              ]
            })}
            onMouseLeave={clearPayload}
          >
            <div 
              className={`w-full max-w-[40px] rounded-t-sm transition-all duration-200 ${d.colorClass || color} opacity-85 group-hover:opacity-100 group-hover:brightness-110`}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: '4px' }}
            />
          </div>
        ))}
      </div>
      
      <div className="flex pl-10 pr-2 pt-2 h-6 items-center">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-500 truncate px-0.5">
            {d.label}
          </div>
        ))}
      </div>
      <ChartTooltip {...tooltip} />
    </div>
  )
}

function LineChart({ data, color = '#3b82f6', fill = false, valuePrefix = '' }) {
  const max = Math.max(...data.map(d => d.value)) || 1
  const min = 0
  const width = 1000
  const height = 300
  
  const { tooltip, handleMouseMove, handleMouseLeave, setPayload, clearPayload } = useChartTooltip()
  const yLabels = [max, max * 0.75, max * 0.5, max * 0.25, 0].map(v => Math.round(v))

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * width
    const y = height - ((d.value - min) / (max - min)) * height
    return { x, y, d }
  })
  
  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
  const areaPath = `${pathData} L ${width},${height} L 0,${height} Z`

  return (
    <div 
      className="relative flex flex-col h-full min-h-[240px] w-full pt-4 select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none">
        {yLabels.map((val, i) => (
          <div key={i} className="flex items-center w-full h-0 relative">
            <span className="absolute -left-1 text-[10px] text-slate-400 -translate-x-full -translate-y-1/2 w-8 text-right pr-2">
              {val >= 1000 ? (val/1000).toFixed(1)+'k' : val}
            </span>
            <div className="w-full border-t border-slate-100 border-dashed"></div>
          </div>
        ))}
      </div>

      <div className="relative w-full flex-1 mt-2 pl-10 pr-2 z-10">
        <svg viewBox={`-10 -10 ${width + 20} ${height + 20}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          {fill && <path d={areaPath} fill={color} fillOpacity={0.1} className="transition-all duration-300" />}
          <path d={pathData} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" className="transition-all duration-300" />
          
          {points.map((p, i) => (
            <g key={i} 
              className="cursor-pointer group"
              onMouseEnter={() => setPayload({
                title: p.d.label,
                lines: [
                  { label: p.d.metricName || 'Value', value: `${valuePrefix}${p.d.value.toLocaleString()}`, color },
                  ...(p.d.growth ? [{ label: 'Growth', value: p.d.growth, color: p.d.growth.startsWith('+') ? '#10b981' : '#ef4444' }] : [])
                ]
              })}
              onMouseLeave={clearPayload}
            >
              {/* Invisible larger hover target */}
              <circle cx={p.x} cy={p.y} r="30" fill="transparent" />
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="6" 
                fill="#fff" 
                stroke={color} 
                strokeWidth="3" 
                className="transition-all duration-200 group-hover:r-[10px] group-hover:stroke-[4px]" 
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="flex pl-10 pr-2 pt-2 h-6 items-center justify-between">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-slate-500 truncate px-1 text-center flex-1">
            {d.label}
          </span>
        ))}
      </div>
      <ChartTooltip {...tooltip} />
    </div>
  )
}

function DoughnutChart({ data, cutout = '60%' }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const { tooltip, handleMouseMove, handleMouseLeave, setPayload, clearPayload } = useChartTooltip()
  
  if (total === 0 || !data || data.length === 0) {
    return (
      <div className="flex h-full w-full flex-1 items-center justify-center min-h-[220px]">
        <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed border-slate-200 text-sm text-slate-400">
          No Data
        </div>
      </div>
    )
  }

  const isPie = !cutout || cutout === false || cutout === '0%'
  const radius = isPie ? 25 : 40
  const strokeW = isPie ? 50 : 20
  const circumference = 2 * Math.PI * radius
  let currentOffset = 0

  return (
    <div 
      className="relative flex flex-col md:flex-row items-center gap-6 h-full min-h-[220px] w-full justify-center md:justify-around p-2 select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-40 h-40 md:w-48 md:h-48 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 drop-shadow-sm overflow-visible">
          {data.map((d, i) => {
            const percentage = d.value / total
            const strokeDasharray = `${percentage * circumference} ${circumference}`
            const strokeDashoffset = -currentOffset
            currentOffset += percentage * circumference
            
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={d.color || '#e2e8f0'}
                strokeWidth={strokeW}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-200 hover:opacity-90 cursor-pointer outline-none hover:stroke-[22px] origin-center"
                style={!isPie ? { transformOrigin: '50px 50px' } : {}}
                onMouseEnter={() => setPayload({
                  title: d.label,
                  lines: [
                    { label: 'Count', value: d.value.toLocaleString(), color: d.color },
                    { label: 'Percentage', value: `${(percentage * 100).toFixed(1)}%`, color: '#94a3b8' }
                  ]
                })}
                onMouseLeave={clearPayload}
              />
            )
          })}
        </svg>
      </div>
      <div className="flex flex-col justify-center space-y-3 min-w-[140px]">
        {data.map((d, i) => {
          const percentage = (d.value / total) * 100
          return (
            <div key={i} className="flex items-center justify-between text-sm gap-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="text-slate-600 truncate max-w-[100px]" title={d.label}>{d.label}</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="font-semibold text-slate-900">{d.value.toLocaleString()}</span>
                <span className="text-slate-400 text-xs w-8">({percentage.toFixed(0)}%)</span>
              </div>
            </div>
          )
        })}
      </div>
      <ChartTooltip {...tooltip} />
    </div>
  )
}

function StackedBarChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  const { tooltip, handleMouseMove, handleMouseLeave, setPayload, clearPayload } = useChartTooltip()

  return (
    <div 
      className="relative w-full flex flex-col justify-center h-full min-h-[160px] select-none pt-4"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex h-10 w-full overflow-hidden rounded-full shadow-inner">
        {data.map((d, i) => {
          const percentage = (d.value / total) * 100
          return (
            <div 
              key={i} 
              style={{ width: `${percentage}%`, backgroundColor: d.color }} 
              className="h-full transition-all duration-200 hover:opacity-90 hover:brightness-110 cursor-pointer"
              onMouseEnter={() => setPayload({
                title: d.metricName || 'Distribution',
                lines: [
                  { label: d.label, value: d.value.toLocaleString(), color: d.color },
                  { label: 'Percentage', value: `${percentage.toFixed(1)}%`, color: '#94a3b8' }
                ]
              })}
              onMouseLeave={clearPayload}
            />
          )
        })}
      </div>
      <div className="mt-8 flex flex-wrap gap-6 justify-center">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }}></span>
            <span className="text-slate-600">{d.label}</span>
            <span className="font-semibold text-slate-900">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <ChartTooltip {...tooltip} />
    </div>
  )
}

function HorizontalBarChart({ data, valuePrefix = '' }) {
  const max = Math.max(...data.map(d => d.value)) || 1
  const { tooltip, handleMouseMove, handleMouseLeave, setPayload, clearPayload } = useChartTooltip()

  return (
    <div 
      className="relative flex flex-col h-full min-h-[220px] w-full pt-4 pb-2 gap-4 select-none justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {data.map((d, i) => (
        <div 
          key={i} 
          className="group relative flex items-center gap-3 cursor-pointer"
          onMouseEnter={() => setPayload({
            title: d.label,
            lines: [
              { label: d.metricName || 'Value', value: `${valuePrefix}${d.value.toLocaleString()}`, color: d.colorHex || '#3b82f6' },
              ...(d.percentage ? [{ label: 'Percentage', value: d.percentage, color: '#94a3b8' }] : [])
            ]
          })}
          onMouseLeave={clearPayload}
        >
          <div className="w-28 shrink-0 text-[12px] font-medium text-slate-600 truncate text-right" title={d.label}>
            {d.label}
          </div>
          <div className="flex-1 h-6 bg-slate-100 rounded-r-md overflow-hidden flex items-center">
            <div 
              className={`h-full transition-all duration-300 ${d.colorClass || 'bg-blue-500'} opacity-85 group-hover:opacity-100 group-hover:brightness-110`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <div className="w-14 shrink-0 text-[12px] font-semibold text-slate-700 text-left">
            {valuePrefix}{d.value >= 1000 ? (d.value/1000).toFixed(1)+'k' : d.value}
          </div>
        </div>
      ))}
      <ChartTooltip {...tooltip} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// Generate mock data dynamically
const generateMockData = (appliedFilters) => {
  const multiplier = appliedFilters.company === 'all' ? 1 : 0.2
  const planM = appliedFilters.plan === 'all' ? 1 : 0.4
  const finalM = multiplier * planM
  
  return {
    company: {
      kpis: {
        total: Math.floor(124 * finalM),
        active: Math.floor(98 * finalM),
        trial: Math.floor(15 * finalM),
        suspended: Math.floor(11 * finalM),
        new: Math.floor(8 * finalM)
      },
      growthChart: [
        { label: 'Jan', value: Math.floor(85 * finalM), metricName: 'Companies', growth: '+2%' },
        { label: 'Feb', value: Math.floor(92 * finalM), metricName: 'Companies', growth: '+8%' },
        { label: 'Mar', value: Math.floor(104 * finalM), metricName: 'Companies', growth: '+13%' },
        { label: 'Apr', value: Math.floor(112 * finalM), metricName: 'Companies', growth: '+7%' },
        { label: 'May', value: Math.floor(118 * finalM), metricName: 'Companies', growth: '+5%' },
        { label: 'Jun', value: Math.floor(124 * finalM), metricName: 'Companies', growth: '+5%' },
      ],
      statusChart: [
        { label: 'Active', value: Math.floor(98 * finalM), color: '#10b981' },
        { label: 'Trial', value: Math.floor(15 * finalM), color: '#3b82f6' },
        { label: 'Suspended', value: Math.floor(11 * finalM), color: '#ef4444' }
      ],
      planChart: [
        { label: 'Basic', value: Math.floor(45 * finalM), color: '#94a3b8' },
        { label: 'Pro', value: Math.floor(35 * finalM), color: '#8b5cf6' },
        { label: 'Enterprise', value: Math.floor(18 * finalM), color: '#f59e0b' }
      ],
      registrationsChart: [
        { label: 'Jan', value: Math.floor(5 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'New Companies' },
        { label: 'Feb', value: Math.floor(7 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'New Companies' },
        { label: 'Mar', value: Math.floor(12 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'New Companies' },
        { label: 'Apr', value: Math.floor(8 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'New Companies' },
        { label: 'May', value: Math.floor(6 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'New Companies' },
        { label: 'Jun', value: Math.floor(8 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'New Companies' },
      ]
    },
    billing: {
      kpis: {
        activeSubs: Math.floor(95 * finalM),
        trialSubs: Math.floor(15 * finalM),
        expiredSubs: Math.floor(14 * finalM),
        monthlyRev: 45200 * finalM,
        annualRev: 542400 * finalM,
        renewalRate: '94%',
        failedPayments: Math.floor(3 * finalM),
      },
      revenueChart: [
        { label: 'Jan', value: 31000 * finalM, metricName: 'Revenue', growth: '+4%' },
        { label: 'Feb', value: 33500 * finalM, metricName: 'Revenue', growth: '+8%' },
        { label: 'Mar', value: 38000 * finalM, metricName: 'Revenue', growth: '+13%' },
        { label: 'Apr', value: 41200 * finalM, metricName: 'Revenue', growth: '+8%' },
        { label: 'May', value: 43000 * finalM, metricName: 'Revenue', growth: '+4%' },
        { label: 'Jun', value: 45200 * finalM, metricName: 'Revenue', growth: '+5%' },
      ],
      planChart: [
        { label: 'Basic', value: Math.floor(45 * finalM), color: '#94a3b8' },
        { label: 'Pro', value: Math.floor(35 * finalM), color: '#8b5cf6' },
        { label: 'Enterprise', value: Math.floor(15 * finalM), color: '#f59e0b' }
      ],
      renewalsChart: [
        { label: 'Wk1', value: Math.floor(12 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Renewals' },
        { label: 'Wk2', value: Math.floor(25 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Renewals' },
        { label: 'Wk3', value: Math.floor(18 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Renewals' },
        { label: 'Wk4', value: Math.floor(40 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Renewals' }
      ],
      revenueByPlanChart: [
        { label: 'Basic', value: Math.floor(12500 * finalM), color: '#94a3b8' },
        { label: 'Pro', value: Math.floor(17500 * finalM), color: '#8b5cf6' },
        { label: 'Enterprise', value: Math.floor(15200 * finalM), color: '#f59e0b' }
      ]
    },
    support: {
      kpis: {
        totalTickets: Math.floor(854 * finalM),
        openTickets: Math.floor(32 * finalM),
        closedTickets: Math.floor(790 * finalM),
        pendingTickets: Math.floor(32 * finalM),
        avgResolutionTime: '4h 15m'
      },
      statusChart: [
        { label: 'Closed', value: Math.floor(790 * finalM), color: '#10b981', metricName: 'Tickets' },
        { label: 'Open', value: Math.floor(32 * finalM), color: '#ef4444', metricName: 'Tickets' },
        { label: 'Pending', value: Math.floor(32 * finalM), color: '#f59e0b', metricName: 'Tickets' }
      ],
      categoriesChart: [
        { label: 'Technical', value: Math.floor(420 * finalM), color: '#3b82f6' },
        { label: 'Billing', value: Math.floor(280 * finalM), color: '#8b5cf6' },
        { label: 'General', value: Math.floor(154 * finalM), color: '#10b981' }
      ],
      priorityChart: [
        { label: 'High', value: Math.floor(120 * finalM), color: '#ef4444' },
        { label: 'Medium', value: Math.floor(450 * finalM), color: '#f59e0b' },
        { label: 'Low', value: Math.floor(284 * finalM), color: '#3b82f6' }
      ],
      monthlyTrendChart: [
        { label: 'Jan', value: Math.floor(120 * finalM), metricName: 'Tickets', growth: '-5%' },
        { label: 'Feb', value: Math.floor(145 * finalM), metricName: 'Tickets', growth: '+20%' },
        { label: 'Mar', value: Math.floor(130 * finalM), metricName: 'Tickets', growth: '-10%' },
        { label: 'Apr', value: Math.floor(155 * finalM), metricName: 'Tickets', growth: '+19%' },
        { label: 'May', value: Math.floor(140 * finalM), metricName: 'Tickets', growth: '-9%' },
        { label: 'Jun', value: Math.floor(164 * finalM), metricName: 'Tickets', growth: '+17%' },
      ]
    },
    announcement: {
      kpis: {
        total: Math.floor(45 * finalM),
        active: Math.floor(3 * finalM),
        scheduled: Math.floor(2 * finalM),
        expired: Math.floor(40 * finalM)
      },
      monthChart: [
        { label: 'Jan', value: Math.floor(5 * finalM), colorClass: 'bg-indigo-400', colorHex: '#818cf8', metricName: 'Announcements' },
        { label: 'Feb', value: Math.floor(8 * finalM), colorClass: 'bg-indigo-400', colorHex: '#818cf8', metricName: 'Announcements' },
        { label: 'Mar', value: Math.floor(12 * finalM), colorClass: 'bg-indigo-400', colorHex: '#818cf8', metricName: 'Announcements' },
        { label: 'Apr', value: Math.floor(6 * finalM), colorClass: 'bg-indigo-400', colorHex: '#818cf8', metricName: 'Announcements' },
        { label: 'May', value: Math.floor(10 * finalM), colorClass: 'bg-indigo-400', colorHex: '#818cf8', metricName: 'Announcements' },
        { label: 'Jun', value: Math.floor(4 * finalM), colorClass: 'bg-indigo-400', colorHex: '#818cf8', metricName: 'Announcements' },
      ],
      statusChart: [
        { label: 'Active', value: Math.floor(3 * finalM), color: '#10b981' },
        { label: 'Scheduled', value: Math.floor(2 * finalM), color: '#3b82f6' },
        { label: 'Expired', value: Math.floor(40 * finalM), color: '#94a3b8' }
      ]
    },
    audit: {
      kpis: {
        total: Math.floor(14500 * finalM),
        successful: Math.floor(14100 * finalM),
        failed: Math.floor(350 * finalM),
        suspicious: Math.floor(50 * finalM),
        logins: Math.floor(5200 * finalM)
      },
      dailyChart: [
        { label: 'Mon', value: Math.floor(2100 * finalM), metricName: 'Activities', growth: '+2%' },
        { label: 'Tue', value: Math.floor(2400 * finalM), metricName: 'Activities', growth: '+14%' },
        { label: 'Wed', value: Math.floor(1900 * finalM), metricName: 'Activities', growth: '-20%' },
        { label: 'Thu', value: Math.floor(2600 * finalM), metricName: 'Activities', growth: '+36%' },
        { label: 'Fri', value: Math.floor(2800 * finalM), metricName: 'Activities', growth: '+7%' },
        { label: 'Sat', value: Math.floor(1200 * finalM), metricName: 'Activities', growth: '-57%' },
        { label: 'Sun', value: Math.floor(1500 * finalM), metricName: 'Activities', growth: '+25%' },
      ],
      moduleChart: [
        { label: 'Logins', value: Math.floor(5200 * finalM), colorClass: 'bg-slate-500', colorHex: '#64748b', metricName: 'Events' },
        { label: 'Users', value: Math.floor(3100 * finalM), colorClass: 'bg-slate-500', colorHex: '#64748b', metricName: 'Events' },
        { label: 'Billing', value: Math.floor(2800 * finalM), colorClass: 'bg-slate-500', colorHex: '#64748b', metricName: 'Events' },
        { label: 'Settings', value: Math.floor(3400 * finalM), colorClass: 'bg-slate-500', colorHex: '#64748b', metricName: 'Events' },
      ],
      statusChart: [
        { label: 'Success', value: Math.floor(14100 * finalM), color: '#10b981' },
        { label: 'Failed', value: Math.floor(350 * finalM), color: '#f59e0b' },
        { label: 'Suspicious', value: Math.floor(50 * finalM), color: '#ef4444' }
      ],
      topCompaniesChart: [
        { label: 'Acme Corp', value: Math.floor(3200 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Events' },
        { label: 'Stark Industries', value: Math.floor(2800 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Events' },
        { label: 'Wayne Enterprises', value: Math.floor(2100 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Events' },
        { label: 'LexCorp', value: Math.floor(1500 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Events' },
        { label: 'Oscorp', value: Math.floor(900 * finalM), colorClass: 'bg-emerald-500', colorHex: '#10b981', metricName: 'Events' },
      ],
      topOperatorsChart: [
        { label: 'admin@acme.com', value: Math.floor(850 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'Events' },
        { label: 'tony@stark.com', value: Math.floor(720 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'Events' },
        { label: 'bruce@wayne.com', value: Math.floor(640 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'Events' },
        { label: 'lex@lexcorp.com', value: Math.floor(410 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'Events' },
        { label: 'norman@oscorp.com', value: Math.floor(230 * finalM), colorClass: 'bg-blue-500', colorHex: '#3b82f6', metricName: 'Events' },
      ]
    },
    platform: {
      activityChart: [
        { label: 'Mon', value: Math.floor(1200 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
        { label: 'Tue', value: Math.floor(1450 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
        { label: 'Wed', value: Math.floor(1300 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
        { label: 'Thu', value: Math.floor(1600 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
        { label: 'Fri', value: Math.floor(1550 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
        { label: 'Sat', value: Math.floor(400 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
        { label: 'Sun', value: Math.floor(350 * finalM), colorClass: 'bg-amber-500', colorHex: '#f59e0b', metricName: 'Activity' },
      ],
      supportActivityChart: [
        { label: 'Mon', value: Math.floor(145 * finalM), metricName: 'Tickets', growth: '+5%' },
        { label: 'Tue', value: Math.floor(160 * finalM), metricName: 'Tickets', growth: '+10%' },
        { label: 'Wed', value: Math.floor(130 * finalM), metricName: 'Tickets', growth: '-18%' },
        { label: 'Thu', value: Math.floor(180 * finalM), metricName: 'Tickets', growth: '+38%' },
        { label: 'Fri', value: Math.floor(150 * finalM), metricName: 'Tickets', growth: '-16%' },
        { label: 'Sat', value: Math.floor(40 * finalM), metricName: 'Tickets', growth: '-73%' },
        { label: 'Sun', value: Math.floor(25 * finalM), metricName: 'Tickets', growth: '-37%' },
      ],
      auditActivityChart: [
        { label: 'Mon', value: Math.floor(2100 * finalM), metricName: 'Activities', growth: '+2%' },
        { label: 'Tue', value: Math.floor(2400 * finalM), metricName: 'Activities', growth: '+14%' },
        { label: 'Wed', value: Math.floor(1900 * finalM), metricName: 'Activities', growth: '-20%' },
        { label: 'Thu', value: Math.floor(2600 * finalM), metricName: 'Activities', growth: '+36%' },
        { label: 'Fri', value: Math.floor(2800 * finalM), metricName: 'Activities', growth: '+7%' },
        { label: 'Sat', value: Math.floor(1200 * finalM), metricName: 'Activities', growth: '-57%' },
        { label: 'Sun', value: Math.floor(1500 * finalM), metricName: 'Activities', growth: '+25%' },
      ],
    }
  }
}

export default function SuperAdminReportsPage() {
  const toast = useToast()
  const [filters, setFilters] = useState({
    dateRange: 'this_month',
    company: 'all',
    plan: 'all',
    status: 'all'
  })
  const [appliedFilters, setAppliedFilters] = useState({ ...filters })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('company')

  const data = generateMockData(appliedFilters)

  const handleApply = () => {
    setLoading(true)
    setTimeout(() => {
      setAppliedFilters({ ...filters })
      setLoading(false)
      toast.success('Reports updated based on filters')
    }, 600)
  }

  const handleReset = () => {
    const defaultFilters = { dateRange: 'this_month', company: 'all', plan: 'all', status: 'all' }
    setFilters(defaultFilters)
    setLoading(true)
    setTimeout(() => {
      setAppliedFilters(defaultFilters)
      setLoading(false)
      toast.success('Filters reset to default')
    }, 600)
  }

  const handleExport = (format) => {
    toast.success(`Exporting reports as ${format.toUpperCase()}...`)
  }

  const isEmpty = appliedFilters.company === 'none'

  return (
    <div className="pb-12">
      <PageHeader 
        title="Reports & Analytics" 
        subtitle="View platform-wide reports and analytics across all tenant companies." 
      />

      <Card className="mb-8 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px] flex-1">
            <Select label="Date Range" value={filters.dateRange} onChange={e => setFilters({...filters, dateRange: e.target.value})}>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="all_time">All Time</option>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1">
            <Select label="Company" value={filters.company} onChange={e => setFilters({...filters, company: e.target.value})}>
              <option value="all">All Companies</option>
              <option value="acme">Acme Corp</option>
              <option value="stark">Stark Industries</option>
              <option value="wayne">Wayne Enterprises</option>
              <option value="none">Ghost Town LLC (Empty)</option>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1">
            <Select label="Subscription Plan" value={filters.plan} onChange={e => setFilters({...filters, plan: e.target.value})}>
              <option value="all">All Plans</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1">
            <Select label="Company Status" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 pt-2 md:pt-0">
            <Button onClick={handleApply} disabled={loading}>{loading ? 'Applying...' : 'Apply Filters'}</Button>
            <Button variant="secondary" onClick={handleReset} disabled={loading}>Reset</Button>
            
            <div className="relative group">
              <Button variant="secondary">Export ▾</Button>
              <div className="absolute right-0 top-full mt-1 hidden w-32 flex-col rounded-md border border-slate-200 bg-white p-1 shadow-lg group-hover:flex z-10">
                <button className="rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => handleExport('pdf')}>PDF</button>
                <button className="rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => handleExport('excel')}>Excel</button>
                <button className="rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => handleExport('csv')}>CSV</button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md pt-4 pb-6 mb-8 -mx-4 px-4 shadow-[0_8px_20px_-15px_rgba(0,0,0,0.1)] border-b border-slate-200">
        <div className="overflow-x-auto scrollbar-hide">
          <nav className="flex gap-3 min-w-max" aria-label="Tabs">
            {[
              { id: 'company', label: 'Company Report' },
              { id: 'billing', label: 'Subscription & Billing Report' },
              { id: 'support', label: 'Support Report' },
              { id: 'announcement', label: 'Announcement Report' },
              { id: 'audit', label: 'Audit Report' },
              { id: 'platform', label: 'Platform Overview' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative whitespace-nowrap rounded-xl px-6 py-3 text-[14px] font-medium transition-all duration-300 outline-none
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] ring-1 ring-blue-600'
                    : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-100'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-40 bg-slate-100 rounded-xl w-full"></div>
          <div className="h-40 bg-slate-100 rounded-xl w-full"></div>
          <div className="h-40 bg-slate-100 rounded-xl w-full"></div>
        </div>
      ) : isEmpty ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
          No report data available.
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* 1. Company Report */}
          {activeTab === 'company' && (
          <Section title="Company Report">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5 mb-6">
              <StatCard label="Total Companies" value={data.company.kpis.total.toLocaleString()} />
              <StatCard label="Active" value={data.company.kpis.active.toLocaleString()} className="text-emerald-600 border-emerald-200 bg-emerald-50/30" />
              <StatCard label="Trial" value={data.company.kpis.trial.toLocaleString()} className="text-blue-600" />
              <StatCard label="Suspended" value={data.company.kpis.suspended.toLocaleString()} className="text-red-600" />
              <StatCard label="New Companies" value={data.company.kpis.new.toLocaleString()} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Company Growth Trend</h3>
                <LineChart data={data.company.growthChart} color="#3b82f6" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Monthly Registrations</h3>
                <BarChart data={data.company.registrationsChart} color="bg-blue-500" />
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Company Status Distribution</h3>
                <DoughnutChart data={data.company.statusChart} cutout="60%" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Companies by Subscription Plan</h3>
                <DoughnutChart data={data.company.planChart} cutout={false} />
              </Card>
            </div>
          </Section>
          )}

          {/* 2. Subscription & Billing Report */}
          {activeTab === 'billing' && (
          <Section title="Subscription & Billing Report">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7 mb-6">
              <StatCard label="Active Subs" value={data.billing.kpis.activeSubs.toLocaleString()} />
              <StatCard label="Trial Subs" value={data.billing.kpis.trialSubs.toLocaleString()} />
              <StatCard label="Expired Subs" value={data.billing.kpis.expiredSubs.toLocaleString()} className="text-red-600" />
              <StatCard label="Monthly Revenue" value={formatMoney(data.billing.kpis.monthlyRev)} className="text-emerald-700 font-bold bg-emerald-50/50" />
              <StatCard label="Annual Revenue" value={formatMoney(data.billing.kpis.annualRev)} />
              <StatCard label="Renewal Rate" value={data.billing.kpis.renewalRate} />
              <StatCard label="Failed Payments" value={data.billing.kpis.failedPayments.toLocaleString()} className="text-amber-600" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Revenue Trend (USD)</h3>
                <LineChart data={data.billing.revenueChart} color="#10b981" fill={true} valuePrefix="$" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Monthly Renewals</h3>
                <BarChart data={data.billing.renewalsChart} color="bg-emerald-500" />
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Subscription Plan Distribution</h3>
                <DoughnutChart data={data.billing.planChart} cutout="60%" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Revenue by Plan</h3>
                <DoughnutChart data={data.billing.revenueByPlanChart} cutout="60%" />
              </Card>
            </div>
          </Section>
          )}

          {/* 3. Support Report */}
          {activeTab === 'support' && (
          <Section title="Support Report">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5 mb-6">
              <StatCard label="Total Tickets" value={data.support.kpis.totalTickets.toLocaleString()} />
              <StatCard label="Open Tickets" value={data.support.kpis.openTickets.toLocaleString()} className="text-red-600" />
              <StatCard label="Closed Tickets" value={data.support.kpis.closedTickets.toLocaleString()} className="text-slate-500" />
              <StatCard label="Pending Tickets" value={data.support.kpis.pendingTickets.toLocaleString()} className="text-amber-600" />
              <StatCard label="Avg Resolution" value={data.support.kpis.avgResolutionTime} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Ticket Status Distribution</h3>
                <StackedBarChart data={data.support.statusChart} />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Monthly Ticket Trend</h3>
                <LineChart data={data.support.monthlyTrendChart} color="#8b5cf6" />
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Tickets by Category</h3>
                <DoughnutChart data={data.support.categoriesChart} cutout={false} />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Tickets by Priority</h3>
                <DoughnutChart data={data.support.priorityChart} cutout={false} />
              </Card>
            </div>
          </Section>
          )}

          {/* 4. Announcement Report */}
          {activeTab === 'announcement' && (
          <Section title="Announcement Report">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
              <StatCard label="Total Announcements" value={data.announcement.kpis.total.toLocaleString()} />
              <StatCard label="Active" value={data.announcement.kpis.active.toLocaleString()} className="text-emerald-600" />
              <StatCard label="Scheduled" value={data.announcement.kpis.scheduled.toLocaleString()} className="text-blue-600" />
              <StatCard label="Expired" value={data.announcement.kpis.expired.toLocaleString()} className="text-slate-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Announcements by Month</h3>
                <BarChart data={data.announcement.monthChart} color="bg-indigo-400" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Announcement Status Distribution</h3>
                <DoughnutChart data={data.announcement.statusChart} cutout="60%" />
              </Card>
            </div>
          </Section>
          )}

          {/* 5. Audit Report */}
          {activeTab === 'audit' && (
          <Section title="Audit Report">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5 mb-6">
              <StatCard label="Total Activities" value={data.audit.kpis.total.toLocaleString()} />
              <StatCard label="Successful" value={data.audit.kpis.successful.toLocaleString()} className="text-emerald-600" />
              <StatCard label="Failed" value={data.audit.kpis.failed.toLocaleString()} className="text-amber-600" />
              <StatCard label="Suspicious" value={data.audit.kpis.suspicious.toLocaleString()} className="text-red-600 font-bold bg-red-50/50" />
              <StatCard label="Login Events" value={data.audit.kpis.logins.toLocaleString()} className="text-blue-600" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card className="p-5 flex flex-col lg:col-span-2">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Daily Activity Trend</h3>
                <LineChart data={data.audit.dailyChart} color="#f59e0b" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Success vs Failed vs Suspicious</h3>
                <DoughnutChart data={data.audit.statusChart} cutout="60%" />
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Activities by Module</h3>
                <BarChart data={data.audit.moduleChart} color="bg-slate-500" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Top Active Companies</h3>
                <HorizontalBarChart data={data.audit.topCompaniesChart} />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Top Active Operators</h3>
                <HorizontalBarChart data={data.audit.topOperatorsChart} />
              </Card>
            </div>
          </Section>
          )}

          {/* 6. Platform Overview */}
          {activeTab === 'platform' && (
          <Section title="Platform Overview">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Company Growth Trend</h3>
                <LineChart data={data.company.growthChart} color="#3b82f6" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Revenue Trend (USD)</h3>
                <LineChart data={data.billing.revenueChart} color="#10b981" fill={true} valuePrefix="$" />
              </Card>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Platform Activity (Events)</h3>
                <BarChart data={data.platform.activityChart} color="bg-amber-500" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Support Activity Summary</h3>
                <LineChart data={data.platform.supportActivityChart} color="#8b5cf6" />
              </Card>
              <Card className="p-5 flex flex-col">
                <h3 className="mb-4 text-sm font-medium text-slate-700">Subscription Distribution</h3>
                <DoughnutChart data={data.billing.planChart} cutout="60%" />
              </Card>
            </div>
          </Section>
          )}

        </div>
      )}
    </div>
  )
}
