export const POSSESSION_STATUSES = [
  'Pending',
  'Readiness Check',
  'Ready for Possession',
  'Scheduled',
  'Handover In Progress',
  'Handover Completed',
  'Customer Confirmation Pending',
  'Completed',
  'Cancelled'
]

export const READINESS_CHECKLIST_ITEMS = [
  'Registration Completed',
  'Property Ready',
  'Unit Inspection Completed',
  'Keys Available',
  'Required Documents Ready',
  'Utility / Meter Details Ready',
  'Final Dues Check',
  'Handover Documents Ready'
]

export const POSSESSION_DOCUMENTS = [
  'Possession Letter',
  'Handover Form',
  'Key Handover Acknowledgement',
  'Property Inspection Report',
  'Customer Confirmation',
  'Other Supporting Documents'
]

export const MOCK_POSSESSION_CASES = [
  {
    _id: 'POS-2026-001',
    customerId: 'CUST-088',
    customerName: 'Anita Desai',
    bookingId: 'BK-1088',
    registrationId: 'REG-2026-004',
    project: 'Blue Ridge',
    unitNumber: 'D-505',
    branch: 'Pune West',
    assignedEmployee: 'Rahul Verma',
    expectedPossessionDate: '2026-08-25',
    scheduledDate: '',
    scheduledTime: '',
    actualPossessionDate: '',
    status: 'Readiness Check',
    location: '',
    customerConfirmation: 'Pending',
    remarks: 'Awaiting final dues check from Finance before scheduling.',
    lastUpdated: '2026-08-11T12:00:00Z',
    checklist: [
      { item: 'Registration Completed', status: 'Completed', date: '2026-08-11', user: 'System' },
      { item: 'Property Ready', status: 'Completed', date: '2026-08-11', user: 'Rahul Verma' },
      { item: 'Unit Inspection Completed', status: 'Pending', date: '', user: '' },
      { item: 'Keys Available', status: 'Completed', date: '2026-08-11', user: 'Rahul Verma' },
      { item: 'Required Documents Ready', status: 'Completed', date: '2026-08-11', user: 'Rahul Verma' },
      { item: 'Utility / Meter Details Ready', status: 'Completed', date: '2026-08-11', user: 'Rahul Verma' },
      { item: 'Final Dues Check', status: 'Pending', date: '', user: '' },
      { item: 'Handover Documents Ready', status: 'Pending', date: '', user: '' }
    ],
    timeline: [
      { id: 1, date: '2026-08-11T11:00:00Z', user: 'System', activity: 'Possession Case Created', remarks: 'Triggered by Registration Completion' },
      { id: 2, date: '2026-08-11T11:15:00Z', user: 'Rahul Verma', activity: 'Readiness Check Started', remarks: '' }
    ],
    documents: []
  },
  {
    _id: 'POS-2026-002',
    customerId: 'CUST-021',
    customerName: 'Vikram Singh',
    bookingId: 'BK-1011',
    registrationId: 'REG-2026-001', // Example historical
    project: 'Sunrise Towers',
    unitNumber: 'A-201',
    branch: 'Mumbai North',
    assignedEmployee: 'Amit Patel',
    expectedPossessionDate: '2026-08-14',
    scheduledDate: '2026-08-14',
    scheduledTime: '11:00 AM',
    actualPossessionDate: '',
    status: 'Scheduled',
    location: 'Site Office, Sunrise Towers',
    customerConfirmation: 'Pending',
    remarks: 'Customer will visit with family.',
    lastUpdated: '2026-08-10T09:00:00Z',
    checklist: [
      { item: 'Registration Completed', status: 'Completed', date: '2026-08-01', user: 'System' },
      { item: 'Property Ready', status: 'Completed', date: '2026-08-05', user: 'Amit Patel' },
      { item: 'Unit Inspection Completed', status: 'Completed', date: '2026-08-06', user: 'Amit Patel' },
      { item: 'Keys Available', status: 'Completed', date: '2026-08-06', user: 'Amit Patel' },
      { item: 'Required Documents Ready', status: 'Completed', date: '2026-08-07', user: 'Amit Patel' },
      { item: 'Utility / Meter Details Ready', status: 'Completed', date: '2026-08-07', user: 'Amit Patel' },
      { item: 'Final Dues Check', status: 'Completed', date: '2026-08-08', user: 'Finance Admin' },
      { item: 'Handover Documents Ready', status: 'Completed', date: '2026-08-09', user: 'Amit Patel' }
    ],
    timeline: [
      { id: 1, date: '2026-08-01T10:00:00Z', user: 'System', activity: 'Possession Case Created', remarks: '' },
      { id: 2, date: '2026-08-09T14:30:00Z', user: 'Amit Patel', activity: 'Marked Ready for Possession', remarks: 'All checks cleared.' },
      { id: 3, date: '2026-08-10T09:00:00Z', user: 'Amit Patel', activity: 'Possession Scheduled', remarks: 'Calendar event created.' }
    ],
    documents: [
      { id: 'doc1', name: 'Possession_Letter_Draft.pdf', type: 'Possession Letter', status: 'Verified', uploadedBy: 'Amit Patel', uploadDate: '2026-08-09', verifiedBy: 'Amit Patel', verificationDate: '2026-08-09', remarks: 'Ready for signature' }
    ]
  },
  {
    _id: 'POS-2026-003',
    customerId: 'CUST-002',
    customerName: 'Priya Sharma',
    bookingId: 'BK-1002',
    registrationId: 'REG-2025-089',
    project: 'Green Valley',
    unitNumber: 'C-302',
    branch: 'Pune East',
    assignedEmployee: 'Neha Gupta',
    expectedPossessionDate: '2026-08-05',
    scheduledDate: '2026-08-05',
    scheduledTime: '10:00 AM',
    actualPossessionDate: '2026-08-05',
    status: 'Completed',
    location: 'Site Office',
    customerConfirmation: 'Confirmed',
    remarks: 'Possession completed successfully. Keys handed over.',
    lastUpdated: '2026-08-06T10:00:00Z',
    checklist: [], // Omitting checklist for brevity on completed cases
    timeline: [
      { id: 1, date: '2026-08-05T11:30:00Z', user: 'Neha Gupta', activity: 'Handover Completed', remarks: 'Keys and forms signed.' },
      { id: 2, date: '2026-08-06T09:00:00Z', user: 'Customer (Portal)', activity: 'Customer Confirmation Received', remarks: '' },
      { id: 3, date: '2026-08-06T10:00:00Z', user: 'System', activity: 'Possession Completed', remarks: 'Customer moved to post-possession support.' }
    ],
    documents: [
      { id: 'doc2', name: 'Signed_Handover.pdf', type: 'Handover Form', status: 'Verified', uploadedBy: 'Neha Gupta', uploadDate: '2026-08-05', verifiedBy: 'System', verificationDate: '2026-08-05', remarks: '' }
    ]
  }
]
