import { useState, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { customersApi } from '../api/resources.js'
import { useToast } from '../context/ToastContext.jsx'
import { Modal, Button, Select } from './ui.jsx'

// Standard headers for sample template and mapping
const TEMPLATE_HEADERS = [
  'Full Name*',
  'Mobile Number*',
  'Email',
  'Alternate Mobile',
  'Source',
  'Min Budget',
  'Max Budget',
  'Property Type',
  'Configuration',
  'Preferred Location',
  'Priority',
  'Sales Executive',
  'Notes',
]

const SAMPLE_ROWS = [
  [
    'Rajesh Sharma',
    '9823012345',
    'rajesh.sharma@example.com',
    '9823012346',
    'Website',
    '5000000',
    '7500000',
    'Apartment',
    '2 BHK',
    'Panaji',
    'High',
    'Aadhya Joshi',
    'Looking for sea-facing 2 BHK flat near Miramar',
  ],
  [
    'Priya Patel',
    '9890123456',
    'priya.patel@example.com',
    '',
    'Magicbricks',
    '8000000',
    '12000000',
    'Villa',
    '3 BHK',
    'Candolim',
    'Medium',
    '',
    'Interested in gated community with clubhouse',
  ],
  [
    'Amit Verma',
    '9765432100',
    'amit.verma@example.com',
    '',
    'Walk In',
    '3500000',
    '4500000',
    'Apartment',
    '1 BHK',
    'Porvorim',
    'Low',
    'Arjun Kapoor',
    'First-time home buyer, flexible on possession date',
  ],
]

function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function cleanMobile(val) {
  if (!val) return ''
  let d = String(val).replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}

export default function ImportLeadsModal({ execs = [], onClose, onDone }) {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [defaultExecutiveId, setDefaultExecutiveId] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'valid' | 'errors'

  // Build fast lookup for sales executives
  const execLookup = useMemo(() => {
    const byId = new Map()
    const byName = new Map()
    const byEmail = new Map()
    for (const e of execs) {
      byId.set(String(e._id), e)
      byName.set(e.name.toLowerCase().trim(), e)
      if (e.email) byEmail.set(e.email.toLowerCase().trim(), e)
    }
    return { byId, byName, byEmail }
  }, [execs])

  const defaultExecUser = useMemo(() => {
    return execLookup.byId.get(String(defaultExecutiveId)) || null
  }, [execLookup, defaultExecutiveId])

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new()
      const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS]
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Set column widths
      ws['!cols'] = [
        { wch: 20 }, // Full Name
        { wch: 16 }, // Mobile Number
        { wch: 26 }, // Email
        { wch: 16 }, // Alternate Mobile
        { wch: 14 }, // Source
        { wch: 12 }, // Min Budget
        { wch: 12 }, // Max Budget
        { wch: 16 }, // Property Type
        { wch: 15 }, // Configuration
        { wch: 18 }, // Preferred Location
        { wch: 12 }, // Priority
        { wch: 20 }, // Sales Executive
        { wch: 35 }, // Notes
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Leads Template')
      XLSX.writeFile(wb, 'Leads_Import_Template.xlsx')
      toast.success('Sample template downloaded')
    } catch (err) {
      toast.error('Failed to download template: ' + (err.message || 'Error'))
    }
  }

  // Parse Uploaded Excel/CSV File
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    processFile(selectedFile)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return
    processFile(droppedFile)
  }

  const processFile = (f) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file')
      return
    }

    setParsing(true)
    setFile(f)
    setFileName(f.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        if (!rawJson.length) {
          toast.error('The selected file has no data rows')
          setParsedRows([])
          setParsing(false)
          return
        }

        // Map column headers to standard fields
        const mapped = rawJson.map((row, index) => {
          const item = { _rowIndex: index + 1 }
          for (const [key, val] of Object.entries(row)) {
            const norm = normalizeKey(key)
            if (norm.includes('name') && !norm.includes('project') && !norm.includes('company')) {
              item.name = String(val).trim()
            } else if (norm.includes('altmobile') || norm.includes('secondaryphone') || norm.includes('altphone')) {
              item.altMobile = String(val).trim()
            } else if (norm.includes('mobile') || norm.includes('phone') || norm.includes('contact')) {
              item.mobile = String(val).trim()
            } else if (norm.includes('email')) {
              item.email = String(val).trim()
            } else if (norm.includes('source')) {
              item.source = String(val).trim()
            } else if (norm.includes('minbudget') || norm.includes('budgetmin')) {
              item.budgetMin = String(val).trim()
            } else if (norm.includes('maxbudget') || norm.includes('budgetmax') || norm.includes('budget')) {
              item.budgetMax = String(val).trim()
            } else if (norm.includes('propertytype') || norm.includes('type')) {
              item.propertyType = String(val).trim()
            } else if (norm.includes('config') || norm.includes('bhk')) {
              item.configuration = String(val).trim()
            } else if (norm.includes('location') || norm.includes('city') || norm.includes('preferred')) {
              item.preferredLocation = String(val).trim()
            } else if (norm.includes('priority')) {
              item.priority = String(val).trim()
            } else if (norm.includes('exec') || norm.includes('assigned') || norm.includes('agent') || norm.includes('employee')) {
              item.salesExecutive = String(val).trim()
            } else if (norm.includes('note') || norm.includes('remark') || norm.includes('comment')) {
              item.notes = String(val).trim()
            }
          }
          return item
        })

        setParsedRows(mapped)
        setParsing(false)
        toast.success(`Parsed ${mapped.length} row(s) from file`)
      } catch (err) {
        toast.error('Failed to parse file: ' + (err.message || 'Invalid format'))
        setParsing(false)
      }
    }

    reader.onerror = () => {
      toast.error('Error reading file')
      setParsing(false)
    }

    reader.readAsArrayBuffer(f)
  }

  // Row validation and assignment resolution
  const processedData = useMemo(() => {
    const seenMobiles = new Set()
    return parsedRows.map((r) => {
      const name = (r.name || '').trim()
      const rawMobile = r.mobile || ''
      const mobile = cleanMobile(rawMobile)
      const altMobile = cleanMobile(r.altMobile || '')

      const errors = []

      // Name validation
      if (!name) {
        errors.push('Full name is required')
      } else if (name.length < 2) {
        errors.push('Name must be at least 2 characters')
      }

      // Mobile validation
      if (!mobile) {
        errors.push('Mobile number is required')
      } else if (mobile.length !== 10) {
        errors.push(`Mobile must be 10 digits (${mobile.length}/10)`)
      } else if (!/^[6-9]/.test(mobile)) {
        errors.push('Mobile must start with 6, 7, 8, or 9')
      } else if (seenMobiles.has(mobile)) {
        errors.push(`Duplicate mobile ${mobile} in file`)
      }

      if (mobile) {
        seenMobiles.add(mobile)
      }

      // Resolve executive assignment
      let assignedUser = null
      let matchedVia = null
      const execQuery = (r.salesExecutive || '').trim()

      if (execQuery) {
        if (execLookup.byId.has(execQuery)) {
          assignedUser = execLookup.byId.get(execQuery)
          matchedVia = 'ID'
        } else if (execLookup.byName.has(execQuery.toLowerCase())) {
          assignedUser = execLookup.byName.get(execQuery.toLowerCase())
          matchedVia = 'Name'
        } else if (execLookup.byEmail.has(execQuery.toLowerCase())) {
          assignedUser = execLookup.byEmail.get(execQuery.toLowerCase())
          matchedVia = 'Email'
        }
      }

      // Fallback to default executive if row executive is missing or unmatched
      let usedFallback = false
      if (!assignedUser && defaultExecUser) {
        assignedUser = defaultExecUser
        usedFallback = true
      }

      const isValid = errors.length === 0

      return {
        ...r,
        name,
        mobile,
        altMobile,
        assignedUser,
        matchedVia,
        usedFallback,
        errors,
        isValid,
      }
    })
  }, [parsedRows, execLookup, defaultExecUser])

  const validRows = useMemo(() => processedData.filter((r) => r.isValid), [processedData])
  const errorRows = useMemo(() => processedData.filter((r) => !r.isValid), [processedData])

  const displayedRows = useMemo(() => {
    if (activeTab === 'valid') return validRows
    if (activeTab === 'errors') return errorRows
    return processedData
  }, [activeTab, processedData, validRows, errorRows])

  // Submit valid records to backend
  const handleImport = async () => {
    if (!validRows.length) {
      toast.error('No valid leads available to import')
      return
    }

    setImporting(true)
    try {
      const payloadRows = validRows.map((r) => ({
        name: r.name,
        mobile: r.mobile,
        altMobile: r.altMobile || undefined,
        email: r.email || undefined,
        source: r.source || undefined,
        budgetMin: r.budgetMin ? Number(r.budgetMin) : undefined,
        budgetMax: r.budgetMax ? Number(r.budgetMax) : undefined,
        propertyType: r.propertyType || undefined,
        configuration: r.configuration || undefined,
        preferredLocation: r.preferredLocation || undefined,
        priority: r.priority || undefined,
        salesExecutive: r.assignedUser ? r.assignedUser._id : undefined,
        notes: r.notes || undefined,
      }))

      const res = await customersApi.import({
        fileName: fileName || 'leads_import.xlsx',
        defaultExecutiveId: defaultExecutiveId || undefined,
        rows: payloadRows,
      })

      const data = res.data?.data || {}
      const count = data.successful ?? validRows.length
      const dupes = data.duplicates?.length || 0
      const fails = data.failed?.length || 0

      if (dupes > 0 || fails > 0) {
        toast.info(`Import completed: ${count} imported, ${dupes} duplicates skipped, ${fails} failed`)
      } else {
        toast.success(`Successfully imported ${count} lead(s)!`)
      }

      if (onDone) onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const resetFile = () => {
    setFile(null)
    setFileName('')
    setParsedRows([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Modal
      open
      onClose={onClose}
      extraWide
      title="Import Leads from Excel (.xlsx)"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-slate-500">
            {processedData.length > 0 && (
              <span>
                <strong className="text-slate-700">{validRows.length}</strong> of{' '}
                <strong className="text-slate-700">{processedData.length}</strong> records ready to import
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="min-w-[140px]"
            >
              {importing ? (
                'Importing…'
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">file_upload</span>
                  <span>Import {validRows.length} Valid Leads</span>
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Step 1 & Controls bar */}
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
          {/* Sample template download card */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]">table_view</span>
                <span>Excel Sample Template</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Download pre-formatted template with standard fields and sample data.
              </p>
            </div>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadTemplate}
                className="w-full justify-center text-xs text-blue-700 hover:text-blue-800"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Download Sample Template (.xlsx)</span>
              </Button>
            </div>
          </div>

          {/* Default Executive Selector */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">person_check</span>
                <span>Default Sales Executive</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Applied to leads with no executive assigned in the Excel file.
              </p>
            </div>
            <div className="mt-3">
              <Select
                value={defaultExecutiveId}
                onChange={(e) => setDefaultExecutiveId(e.target.value)}
                className="text-xs"
              >
                <option value="">Unassigned Pool (None)</option>
                {execs.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name} {e.email ? `(${e.email})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Upload Dropzone */}
        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50/70"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
            </div>
            <h4 className="mt-3 text-sm font-semibold text-slate-900">
              Click to upload or drag & drop Excel file
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Supports Microsoft Excel (.xlsx, .xls) and CSV files with lead records
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <span className="material-symbols-outlined text-[22px]">description</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{fileName}</div>
                <div className="text-xs text-slate-500">
                  {parsing ? 'Parsing Excel data…' : `${processedData.length} records parsed`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing || importing}
              >
                Change File
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={resetFile}
                disabled={parsing || importing}
              >
                Remove
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Data Preview & Validation Statistics */}
        {processedData.length > 0 && (
          <div className="space-y-3">
            {/* Summary KPI chips */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All Records ({processedData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  <span>Valid ({validRows.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('errors')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === 'errors'
                      ? 'bg-red-600 text-white'
                      : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>Errors / Skipped ({errorRows.length})</span>
                </button>
              </div>

              {defaultExecUser && (
                <div className="flex items-center gap-1 text-xs text-blue-700">
                  <span className="font-medium">Default Assignee:</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-semibold">
                    {defaultExecUser.name}
                  </span>
                </div>
              )}
            </div>

            {/* Preview Table */}
            <div className="max-h-[340px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[750px] border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center">#</th>
                    <th className="px-3 py-2.5 w-24">Status</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Mobile</th>
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Budget</th>
                    <th className="px-3 py-2.5">Location</th>
                    <th className="px-3 py-2.5">Assigned Executive</th>
                    <th className="px-3 py-2.5">Validation Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No records to display in this tab
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((r) => (
                      <tr
                        key={r._rowIndex}
                        className={!r.isValid ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}
                      >
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-400">
                          {r._rowIndex}
                        </td>
                        <td className="px-3 py-2">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                              <span className="material-symbols-outlined text-[13px]">check</span>
                              <span>Valid</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">
                              <span className="material-symbols-outlined text-[13px]">close</span>
                              <span>Invalid</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {r.name || <span className="text-red-400 italic">Missing</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {r.mobile ? (
                            r.mobile
                          ) : (
                            <span className="text-red-400 italic">Invalid/Missing</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500 capitalize">{r.source || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {r.budgetMax ? `₹${Number(r.budgetMax).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{r.preferredLocation || '—'}</td>
                        <td className="px-3 py-2">
                          {r.assignedUser ? (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-slate-800">{r.assignedUser.name}</span>
                              {r.usedFallback ? (
                                <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] text-blue-600">
                                  Default
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] text-emerald-600">
                                  Excel ({r.matchedVia})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                              Unassigned Pool
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.errors.length > 0 ? (
                            <ul className="list-disc pl-3 text-[11px] text-red-600 space-y-0.5">
                              {r.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium">None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
