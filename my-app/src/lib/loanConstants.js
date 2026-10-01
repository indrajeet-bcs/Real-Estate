export const LOAN_STATUSES = [
  'Not Required',
  'Required',
  'Documents Pending',
  'Application Prepared',
  'Submitted',
  'Under Review',
  'Query Raised',
  'Sanctioned',
  'Partially Disbursed',
  'Fully Disbursed',
  'Rejected',
  'Cancelled',
  'Completed'
]

export const LOAN_TYPES = [
  'Home Loan',
  'Property Loan',
  'Construction Loan',
  'Other'
]

export const FINANCIAL_INSTITUTIONS = [
  'HDFC Bank',
  'SBI Home Loans',
  'ICICI Bank',
  'Axis Bank',
  'LIC Housing Finance',
  'PNB Housing Finance',
  'Bajaj Housing Finance',
  'Other'
]

export const DOCUMENT_TYPES = [
  'PAN',
  'Aadhaar / Identity Proof',
  'Address Proof',
  'Income Proof',
  'Salary Slips',
  'Bank Statements',
  'ITR',
  'Employment Proof',
  'Property Documents',
  'Booking Documents',
  'Loan Application Documents',
  'Sanction Letter',
  'Disbursement Letter',
  'Other Supporting Documents'
]

export const DOCUMENT_STATUSES = [
  'Pending',
  'Received',
  'Verified',
  'Rejected'
]

// Mock Data for testing the UI
export const MOCK_LOAN_CASES = [
  {
    _id: 'LC-2026-001',
    customerId: 'CUST-001',
    customerName: 'Rahul Sharma',
    bookingId: 'BK-1001',
    project: 'Sunrise Towers',
    unitNumber: 'A-402',
    branch: 'Mumbai North',
    loanRequired: true,
    loanAmount: 4500000,
    bank: 'HDFC Bank',
    loanType: 'Home Loan',
    applicationNumber: 'HDFC/HL/2026/08/101',
    applicationDate: '2026-08-01',
    assignedExecutive: 'Amit Patel',
    expectedSanctionDate: '2026-08-15',
    status: 'Under Review',
    sanctionedAmount: null,
    disbursedAmount: 0,
    lastUpdated: '2026-08-10T10:30:00Z',
    timeline: [
      { id: 1, date: '2026-08-01T10:00:00Z', user: 'Admin', activity: 'Loan Case Created', remarks: 'Initial requirement captured' },
      { id: 2, date: '2026-08-02T14:30:00Z', user: 'Amit Patel', activity: 'Application Submitted', remarks: 'Submitted to HDFC branch' },
      { id: 3, date: '2026-08-05T09:15:00Z', user: 'Bank API', activity: 'Bank Review Started', remarks: 'Processing started' }
    ],
    documents: [
      { id: 'doc1', name: 'PAN_Card.pdf', type: 'PAN', status: 'Verified', uploadedBy: 'Amit Patel', uploadDate: '2026-08-01', verifiedBy: 'Amit Patel', verificationDate: '2026-08-02', remarks: 'Clear copy' },
      { id: 'doc2', name: 'Salary_Slip_July.pdf', type: 'Salary Slips', status: 'Verified', uploadedBy: 'Amit Patel', uploadDate: '2026-08-01', verifiedBy: 'Amit Patel', verificationDate: '2026-08-02', remarks: '' }
    ]
  },
  {
    _id: 'LC-2026-002',
    customerId: 'CUST-005',
    customerName: 'Priya Singh',
    bookingId: 'BK-1023',
    project: 'Green Valley',
    unitNumber: 'B-105',
    branch: 'Pune East',
    loanRequired: true,
    loanAmount: 3200000,
    bank: 'SBI Home Loans',
    loanType: 'Property Loan',
    applicationNumber: 'SBI/PL/44921',
    applicationDate: '2026-07-20',
    assignedExecutive: 'Neha Gupta',
    expectedSanctionDate: '2026-08-05',
    status: 'Partially Disbursed',
    sanctionedAmount: 3000000,
    disbursedAmount: 1500000,
    lastUpdated: '2026-08-12T09:00:00Z',
    timeline: [
      { id: 1, date: '2026-07-20T11:00:00Z', user: 'Neha Gupta', activity: 'Loan Case Created', remarks: '' },
      { id: 2, date: '2026-08-05T10:00:00Z', user: 'System', activity: 'Loan Sanctioned', remarks: 'Sanction letter received for 30L' },
      { id: 3, date: '2026-08-12T09:00:00Z', user: 'Neha Gupta', activity: 'Partial Disbursement Recorded', remarks: 'First tranche of 15L released' }
    ],
    documents: [
      { id: 'doc3', name: 'Sanction_Letter.pdf', type: 'Sanction Letter', status: 'Received', uploadedBy: 'Neha Gupta', uploadDate: '2026-08-05', verifiedBy: '', verificationDate: '', remarks: '' }
    ]
  },
  {
    _id: 'LC-2026-003',
    customerId: 'CUST-012',
    customerName: 'Vikram Reddy',
    bookingId: 'BK-1045',
    project: 'Sunrise Towers',
    unitNumber: 'C-201',
    branch: 'Mumbai North',
    loanRequired: true,
    loanAmount: 5000000,
    bank: 'ICICI Bank',
    loanType: 'Home Loan',
    applicationNumber: '',
    applicationDate: '',
    assignedExecutive: 'Amit Patel',
    expectedSanctionDate: '',
    status: 'Documents Pending',
    sanctionedAmount: null,
    disbursedAmount: 0,
    lastUpdated: '2026-08-11T16:45:00Z',
    timeline: [
      { id: 1, date: '2026-08-11T16:45:00Z', user: 'Amit Patel', activity: 'Loan Case Created', remarks: 'Waiting for ITR documents' }
    ],
    documents: []
  }
]
