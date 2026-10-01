export const REGISTRATION_STATUSES = [
  'Pending',
  'Documents Pending',
  'Ready for Registration',
  'Appointment Scheduled',
  'Registration In Progress',
  'Registered',
  'Document Pending', // Usually post-registration waiting for final scanned copy
  'Completed',
  'Cancelled'
]

export const REGISTRATION_TYPES = [
  'Sale Deed Registration',
  'Agreement Registration',
  'Property Registration',
  'Other'
]

export const REGISTRATION_DOCUMENTS = [
  'Sale Agreement',
  'Booking Documents',
  'Customer KYC',
  'PAN',
  'Aadhaar / Identity Proof',
  'Address Proof',
  'Registration Documents',
  'Stamp Duty Proof',
  'Registration Receipt',
  'Registered Agreement',
  'Other Supporting Documents'
]

export const DOCUMENT_STATUSES = [
  'Pending',
  'Received',
  'Verified',
  'Rejected'
]

export const MOCK_REGISTRATION_CASES = [
  {
    _id: 'REG-2026-001',
    customerId: 'CUST-001',
    customerName: 'Rahul Sharma',
    bookingId: 'BK-1001',
    project: 'Sunrise Towers',
    unitNumber: 'A-402',
    branch: 'Mumbai North',
    registrationType: 'Sale Deed Registration',
    assignedEmployee: 'Amit Patel',
    expectedRegistrationDate: '2026-08-20',
    registrationAuthority: 'Sub-Registrar Office, Andheri',
    status: 'Ready for Registration',
    appointmentDate: '',
    appointmentTime: '',
    registrationNumber: '',
    registrationDate: '',
    remarks: 'Awaiting customer confirmation for appointment.',
    lastUpdated: '2026-08-11T10:30:00Z',
    timeline: [
      { id: 1, date: '2026-08-10T10:00:00Z', user: 'Admin', activity: 'Registration Case Created', remarks: 'Loan completed, moving to registration.' },
      { id: 2, date: '2026-08-11T14:30:00Z', user: 'Amit Patel', activity: 'Marked Ready for Registration', remarks: 'All KYC and stamp duty proofs verified.' }
    ],
    documents: [
      { id: 'doc1', name: 'PAN_Card.pdf', type: 'PAN', status: 'Verified', uploadedBy: 'Amit Patel', uploadDate: '2026-08-10', verifiedBy: 'Amit Patel', verificationDate: '2026-08-11', remarks: '' },
      { id: 'doc2', name: 'Stamp_Duty.pdf', type: 'Stamp Duty Proof', status: 'Verified', uploadedBy: 'Amit Patel', uploadDate: '2026-08-10', verifiedBy: 'Amit Patel', verificationDate: '2026-08-11', remarks: '' }
    ]
  },
  {
    _id: 'REG-2026-002',
    customerId: 'CUST-005',
    customerName: 'Priya Singh',
    bookingId: 'BK-1023',
    project: 'Green Valley',
    unitNumber: 'B-105',
    branch: 'Pune East',
    registrationType: 'Agreement Registration',
    assignedEmployee: 'Neha Gupta',
    expectedRegistrationDate: '2026-08-15',
    registrationAuthority: 'Sub-Registrar Office, Haveli',
    status: 'Appointment Scheduled',
    appointmentDate: '2026-08-15',
    appointmentTime: '11:00 AM',
    appointmentReference: 'APPT-9982',
    registrationNumber: '',
    registrationDate: '',
    remarks: 'Customer will arrive at 10:45 AM.',
    lastUpdated: '2026-08-12T09:00:00Z',
    timeline: [
      { id: 1, date: '2026-08-05T11:00:00Z', user: 'Neha Gupta', activity: 'Registration Case Created', remarks: '' },
      { id: 2, date: '2026-08-12T09:00:00Z', user: 'Neha Gupta', activity: 'Appointment Scheduled', remarks: 'Scheduled for Aug 15' }
    ],
    documents: [
      { id: 'doc3', name: 'Aadhaar.pdf', type: 'Aadhaar / Identity Proof', status: 'Verified', uploadedBy: 'Neha Gupta', uploadDate: '2026-08-05', verifiedBy: 'System', verificationDate: '2026-08-05', remarks: '' }
    ]
  },
  {
    _id: 'REG-2026-003',
    customerId: 'CUST-012',
    customerName: 'Vikram Reddy',
    bookingId: 'BK-1045',
    project: 'Sunrise Towers',
    unitNumber: 'C-201',
    branch: 'Mumbai North',
    registrationType: 'Property Registration',
    assignedEmployee: 'Amit Patel',
    expectedRegistrationDate: '',
    registrationAuthority: '',
    status: 'Documents Pending',
    appointmentDate: '',
    appointmentTime: '',
    registrationNumber: '',
    registrationDate: '',
    remarks: 'Customer traveling, documents will be provided next week.',
    lastUpdated: '2026-08-11T16:45:00Z',
    timeline: [
      { id: 1, date: '2026-08-11T16:45:00Z', user: 'Amit Patel', activity: 'Registration Case Created', remarks: '' }
    ],
    documents: []
  },
  {
    _id: 'REG-2026-004',
    customerId: 'CUST-088',
    customerName: 'Anita Desai',
    bookingId: 'BK-1088',
    project: 'Blue Ridge',
    unitNumber: 'D-505',
    branch: 'Pune West',
    registrationType: 'Sale Deed Registration',
    assignedEmployee: 'Rahul Verma',
    expectedRegistrationDate: '2026-08-10',
    registrationAuthority: 'Sub-Registrar Office, Hinjewadi',
    status: 'Completed',
    appointmentDate: '2026-08-10',
    appointmentTime: '02:00 PM',
    registrationNumber: 'PUN/HW/2026/8892',
    registrationDate: '2026-08-10',
    remarks: 'Successfully registered and final documents collected.',
    lastUpdated: '2026-08-11T10:00:00Z',
    timeline: [
      { id: 1, date: '2026-08-01T10:00:00Z', user: 'Rahul Verma', activity: 'Registration Case Created', remarks: '' },
      { id: 2, date: '2026-08-10T14:30:00Z', user: 'Rahul Verma', activity: 'Registered', remarks: 'Registration successful' },
      { id: 3, date: '2026-08-11T10:00:00Z', user: 'Rahul Verma', activity: 'Registration Case Closed', remarks: 'Final documents uploaded.' }
    ],
    documents: [
      { id: 'doc4', name: 'Final_Deed.pdf', type: 'Registered Agreement', status: 'Verified', uploadedBy: 'Rahul Verma', uploadDate: '2026-08-11', verifiedBy: 'Rahul Verma', verificationDate: '2026-08-11', remarks: 'Original handed over to customer' }
    ]
  }
]
