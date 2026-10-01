export const ROLE_CATEGORIES = [
  'Company',
  'Branch',
  'Department',
  'Team',
  'Operational'
]

export const ROLE_TYPES = [
  'System Role',
  'Custom Role'
]

export const ROLE_STATUSES = [
  'Active',
  'Inactive'
]

export const MOCK_ROLES = [
  {
    id: 'ROLE_SYS_02',
    name: 'Company Owner',
    description: 'Full company-level access and control across the CRM.',
    category: 'Company',
    type: 'System Role',
    reportsTo: null,
    status: 'Active',
    users: 1,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ROLE_SYS_03',
    name: 'Branch Admin',
    description: 'Manages operations and users within assigned branch scope.',
    category: 'Branch',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_02',
    status: 'Active',
    users: 4,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-02-15T10:30:00Z'
  },
  {
    id: 'ROLE_SYS_04',
    name: 'Finance',
    description: 'Manages company finance, payments, expenses, and financial records according to assigned permissions.',
    category: 'Department',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_02',
    status: 'Active',
    users: 3,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ROLE_SYS_05',
    name: 'Marketing',
    description: 'Manages marketing activities, campaigns, and related performance tracking.',
    category: 'Department',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_02',
    status: 'Active',
    users: 2,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ROLE_SYS_06',
    name: 'Team Leader',
    description: 'Manages assigned team operations, leads, activities, and team performance.',
    category: 'Team',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_03',
    status: 'Active',
    users: 8,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-03-10T14:20:00Z'
  },
  {
    id: 'ROLE_SYS_07',
    name: 'CRM Executive',
    description: 'Manages CRM activities and customer/lead operations according to assigned permissions.',
    category: 'Operational',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_06',
    status: 'Active',
    users: 15,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-04-05T09:15:00Z'
  },
  {
    id: 'ROLE_SYS_08',
    name: 'Sales Executive',
    description: 'Manages leads, follow-ups, site visits, bookings, and sales activities according to assigned permissions.',
    category: 'Operational',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_06',
    status: 'Active',
    users: 45,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-05-20T11:45:00Z'
  },
  {
    id: 'ROLE_SYS_09',
    name: 'Telecaller',
    description: 'Manages calling, lead follow-ups, and assigned customer communication activities.',
    category: 'Operational',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_06',
    status: 'Active',
    users: 20,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ROLE_SYS_10',
    name: 'Legal',
    description: 'Manages legal documentation and legal process activities according to assigned permissions.',
    category: 'Department',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_02',
    status: 'Active',
    users: 2,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ROLE_SYS_11',
    name: 'Customer Support',
    description: 'Manages customer support requests, complaints, and post-sales support activities.',
    category: 'Department',
    type: 'System Role',
    reportsTo: 'ROLE_SYS_02',
    status: 'Active',
    users: 5,
    created: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ROLE_CUST_01',
    name: 'Senior Sales Manager',
    description: 'Custom role with elevated discount approval permissions.',
    category: 'Team',
    type: 'Custom Role',
    reportsTo: 'ROLE_SYS_03',
    status: 'Active',
    users: 3,
    created: '2026-06-15T10:00:00Z',
    lastUpdated: '2026-06-15T10:00:00Z'
  },
  {
    id: 'ROLE_CUST_02',
    name: 'Auditor',
    description: 'Read-only access to financial reports and audit logs.',
    category: 'Company',
    type: 'Custom Role',
    reportsTo: 'ROLE_SYS_02',
    status: 'Inactive',
    users: 0,
    created: '2026-07-01T09:00:00Z',
    lastUpdated: '2026-08-01T15:30:00Z'
  }
]

export const MOCK_ROLE_USERS = [
  { id: 'U1001', name: 'Rajesh Sharma', email: 'rajesh.s@company.com', roleId: 'ROLE_SYS_02', roleName: 'Company Owner', branch: 'HQ', status: 'Active', lastLogin: '2026-08-12T09:00:00Z' },
  { id: 'U1002', name: 'Priya Patel', email: 'priya.p@company.com', roleId: 'ROLE_SYS_03', roleName: 'Branch Admin', branch: 'Mumbai North', status: 'Active', lastLogin: '2026-08-11T14:30:00Z' },
  { id: 'U1003', name: 'Amit Kumar', email: 'amit.k@company.com', roleId: 'ROLE_SYS_08', roleName: 'Sales Executive', branch: 'Mumbai North', status: 'Active', lastLogin: '2026-08-12T10:15:00Z' },
  { id: 'U1004', name: 'Sneha Gupta', email: 'sneha.g@company.com', roleId: 'ROLE_SYS_08', roleName: 'Sales Executive', branch: 'Pune West', status: 'Active', lastLogin: '2026-08-10T16:45:00Z' },
  { id: 'U1005', name: 'Vikram Singh', email: 'vikram.s@company.com', roleId: 'ROLE_SYS_06', roleName: 'Team Leader', branch: 'Pune West', status: 'Active', lastLogin: '2026-08-12T08:20:00Z' },
  { id: 'U1006', name: 'Neha Desai', email: 'neha.d@company.com', roleId: 'ROLE_SYS_09', roleName: 'Telecaller', branch: 'HQ', status: 'Inactive', lastLogin: '2026-07-25T11:00:00Z' },
  { id: 'U1007', name: 'Rahul Verma', email: 'rahul.v@company.com', roleId: 'ROLE_SYS_08', roleName: 'Sales Executive', branch: 'Bangalore East', status: 'Active', lastLogin: '2026-08-12T09:30:00Z' },
  { id: 'U1008', name: 'Anjali Nair', email: 'anjali.n@company.com', roleId: 'ROLE_SYS_03', roleName: 'Branch Admin', branch: 'Bangalore East', status: 'Active', lastLogin: '2026-08-12T09:05:00Z' },
  { id: 'U1009', name: 'Sanjay Reddy', email: 'sanjay.r@company.com', roleId: 'ROLE_SYS_04', roleName: 'Finance', branch: 'HQ', status: 'Active', lastLogin: '2026-08-11T17:00:00Z' },
  { id: 'U1010', name: 'Kavita Joshi', email: 'kavita.j@company.com', roleId: 'ROLE_SYS_05', roleName: 'Marketing', branch: 'HQ', status: 'Active', lastLogin: '2026-08-12T10:00:00Z' }
]

export const CRM_MODULES = [
  // Core CRM
  { id: 'MOD_01', name: 'Dashboard', description: 'Main organizational overview and analytics.', category: 'Core CRM', icon: 'dashboard' },
  { id: 'MOD_02', name: 'Lead CRM', description: 'Manage leads, follow-ups, and customer conversion.', category: 'Core CRM', icon: 'contacts' },
  { id: 'MOD_03', name: 'Customer', description: 'View and manage all active customer profiles.', category: 'Core CRM', icon: 'people' },
  { id: 'MOD_04', name: 'Site Visit', description: 'Schedule and track physical property visits.', category: 'Core CRM', icon: 'location_on', dependencies: ['MOD_02'] },
  
  // Property & Sales
  { id: 'MOD_05', name: 'Builder Management', description: 'Manage builder partnerships and inventory lists.', category: 'Property & Sales', icon: 'domain' },
  { id: 'MOD_06', name: 'Sales Property Management', description: 'Primary sales inventory tracking and pricing.', category: 'Property & Sales', icon: 'home_work' },
  { id: 'MOD_07', name: 'Rental Management', description: 'Rental agreements and tenant matching.', category: 'Property & Sales', icon: 'real_estate_agent' },
  { id: 'MOD_08', name: 'Booking & Discount', description: 'Unit reservations and discount approvals.', category: 'Property & Sales', icon: 'event_available', dependencies: ['MOD_02', 'MOD_06'] },

  // Finance & Operations
  { id: 'MOD_09', name: 'Payment', description: 'Track payment schedules and receipts.', category: 'Finance & Operations', icon: 'payments', dependencies: ['MOD_08'] },
  { id: 'MOD_10', name: 'Expense Management', description: 'Company and branch operational expenses.', category: 'Finance & Operations', icon: 'receipt_long' },
  { id: 'MOD_11', name: 'Commission Management', description: 'Calculate and distribute employee commissions.', category: 'Finance & Operations', icon: 'percent' },
  { id: 'MOD_12', name: 'Branch Management', description: 'Manage branch hierarchy and settings.', category: 'Finance & Operations', icon: 'store' },
  { id: 'MOD_13', name: 'Employee Transfer', description: 'Manage internal role or branch transfers.', category: 'Finance & Operations', icon: 'transfer_within_a_station' },
  { id: 'MOD_14', name: 'Attendance & Leave', description: 'Employee time tracking and leave approvals.', category: 'Finance & Operations', icon: 'schedule' },

  // Customer Lifecycle
  { id: 'MOD_15', name: 'Legal', description: 'Agreement drafting and vetting processes.', category: 'Customer Lifecycle', icon: 'gavel', dependencies: ['MOD_08'] },
  { id: 'MOD_16', name: 'Loan', description: 'Home loan processing and bank tracking.', category: 'Customer Lifecycle', icon: 'account_balance', dependencies: ['MOD_08'] },
  { id: 'MOD_17', name: 'Registration', description: 'Property registration workflow tracking.', category: 'Customer Lifecycle', icon: 'how_to_reg', dependencies: ['MOD_08'] },
  { id: 'MOD_18', name: 'Possession', description: 'Final property handover readiness checks.', category: 'Customer Lifecycle', icon: 'key', dependencies: ['MOD_17'] },
  { id: 'MOD_19', name: 'Customer Support', description: 'Post-possession ticketing and issue tracking.', category: 'Customer Lifecycle', icon: 'support_agent', dependencies: ['MOD_18'] },

  // Marketing & Analytics
  { id: 'MOD_20', name: 'Marketing', description: 'Campaign management and lead sourcing.', category: 'Marketing & Analytics', icon: 'campaign' },
  { id: 'MOD_21', name: 'Reports & Analytics', description: 'Deep-dive reporting across all modules.', category: 'Marketing & Analytics', icon: 'assessment' },

  // Platform & Integrations
  { id: 'MOD_22', name: 'Mobile App', description: 'Control access to the mobile companion app.', category: 'Platform & Integrations', icon: 'smartphone' },
  { id: 'MOD_23', name: 'Integrations', description: 'Manage third-party APIs and webhooks.', category: 'Platform & Integrations', icon: 'extension' }
]

export const MOCK_ROLE_MODULE_ACCESS = {
  'ROLE_SYS_01': Object.fromEntries(CRM_MODULES.map(m => [m.id, 'manage'])), // Super Admin has all
  'ROLE_SYS_02': Object.fromEntries(CRM_MODULES.map(m => [m.id, 'manage'])), // Company Owner has all
  'ROLE_SYS_08': {
    'MOD_01': 'view', 
    'MOD_02': 'manage', 
    'MOD_03': 'view', 
    'MOD_04': 'manage', 
    'MOD_06': 'manage', 
    'MOD_08': 'manage'
  } // Sales Exec
}

export const MOCK_PAGES_TABS = {
  'MOD_02': [ // Lead CRM
    { id: 'PAGE_L1', name: 'Lead Dashboard', description: 'Overview metrics and funnel analytics', tabs: [] },
    { id: 'PAGE_L2', name: 'Lead List', description: 'Main searchable grid of leads', tabs: [] },
    { id: 'PAGE_L3', name: 'Lead Details', description: 'Individual lead record view', tabs: [
      { id: 'TAB_L3_1', name: 'Overview' },
      { id: 'TAB_L3_2', name: 'Contact Information', required: true },
      { id: 'TAB_L3_3', name: 'Follow-ups' },
      { id: 'TAB_L3_4', name: 'Site Visits' },
      { id: 'TAB_L3_5', name: 'History' }
    ]}
  ],
  'MOD_08': [ // Booking & Discount
    { id: 'PAGE_B1', name: 'Booking Dashboard', description: 'Overview of recent bookings', tabs: [] },
    { id: 'PAGE_B2', name: 'Booking List', description: 'All bookings in the system', tabs: [] },
    { id: 'PAGE_B3', name: 'Booking Details', description: 'Detailed booking record', tabs: [
      { id: 'TAB_B3_1', name: 'Overview', required: true },
      { id: 'TAB_B3_2', name: 'Payment Information' },
      { id: 'TAB_B3_3', name: 'Documents' },
      { id: 'TAB_B3_4', name: 'Timeline' }
    ]}
  ],
  'MOD_18': [ // Possession
    { id: 'PAGE_P1', name: 'Possession Dashboard', description: 'Handover overview', tabs: [] },
    { id: 'PAGE_P2', name: 'Possession Cases', description: 'List of active handovers', tabs: [] },
    { id: 'PAGE_P3', name: 'Possession Details', description: 'Individual possession record', tabs: [
      { id: 'TAB_P3_1', name: 'Overview', required: true },
      { id: 'TAB_P3_2', name: 'Readiness Checklist' },
      { id: 'TAB_P3_3', name: 'Schedule & Handover' },
      { id: 'TAB_P3_4', name: 'Timeline & Audit' }
    ]}
  ]
}

export const MOCK_ROLE_PAGE_ACCESS = {
  'ROLE_SYS_08': {
    pages: ['PAGE_L1', 'PAGE_L2', 'PAGE_L3', 'PAGE_B1', 'PAGE_B2', 'PAGE_B3'],
    tabs: ['TAB_L3_1', 'TAB_L3_2', 'TAB_L3_3', 'TAB_B3_1', 'TAB_B3_2']
  }
}

export const MOCK_ACTIONS = {
  // Lead CRM (Leads & Buyers)
  'MOD_02': [
    { id: 'ACT_MOD02_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD02_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD02_VIEW'] },
    { id: 'ACT_MOD02_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD02_VIEW'] },
    { id: 'ACT_MOD02_ARCHIVE', name: 'Archive', description: 'Archive records', dependencies: ['ACT_MOD02_VIEW'] },
    { id: 'ACT_MOD02_ASSIGN', name: 'Assign', description: 'Assign records to users', dependencies: ['ACT_MOD02_VIEW'] },
    { id: 'ACT_MOD02_TRANSFER', name: 'Transfer', description: 'Transfer ownership', dependencies: ['ACT_MOD02_VIEW'] },
    { id: 'ACT_MOD02_IMPORT', name: 'Import', description: 'Import records', dependencies: ['ACT_MOD02_CREATE'] },
    { id: 'ACT_MOD02_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD02_VIEW'] }
  ],
  // Customer
  'MOD_03': [
    { id: 'ACT_MOD03_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD03_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD03_VIEW'] },
    { id: 'ACT_MOD03_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD03_VIEW'] },
    { id: 'ACT_MOD03_ARCHIVE', name: 'Archive', description: 'Archive records', dependencies: ['ACT_MOD03_VIEW'] },
    { id: 'ACT_MOD03_TRANSFER', name: 'Transfer', description: 'Transfer ownership', dependencies: ['ACT_MOD03_VIEW'] },
    { id: 'ACT_MOD03_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD03_VIEW'] }
  ],
  // Site Visit
  'MOD_04': [
    { id: 'ACT_MOD04_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD04_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD04_VIEW'] },
    { id: 'ACT_MOD04_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD04_VIEW'] },
    { id: 'ACT_MOD04_CANCEL', name: 'Cancel', description: 'Cancel visits', dependencies: ['ACT_MOD04_VIEW'] },
    { id: 'ACT_MOD04_RESCHEDULE', name: 'Reschedule', description: 'Reschedule visits', dependencies: ['ACT_MOD04_VIEW'] },
    { id: 'ACT_MOD04_ASSIGN', name: 'Assign', description: 'Assign records to users', dependencies: ['ACT_MOD04_VIEW'] },
    { id: 'ACT_MOD04_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD04_VIEW'] }
  ],
  // Sales Property Management
  'MOD_06': [
    { id: 'ACT_MOD06_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD06_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD06_VIEW'] },
    { id: 'ACT_MOD06_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD06_VIEW'] },
    { id: 'ACT_MOD06_ARCHIVE', name: 'Archive', description: 'Archive records', dependencies: ['ACT_MOD06_VIEW'] },
    { id: 'ACT_MOD06_UPDATE_AVAIL', name: 'Update Availability', description: 'Update property availability', dependencies: ['ACT_MOD06_VIEW'] },
    { id: 'ACT_MOD06_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD06_VIEW'] }
  ],
  // Booking & Discount
  'MOD_08': [
    { id: 'ACT_MOD08_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD08_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD08_VIEW'] },
    { id: 'ACT_MOD08_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD08_VIEW'] },
    { id: 'ACT_MOD08_CANCEL', name: 'Cancel', description: 'Cancel records', dependencies: ['ACT_MOD08_VIEW'] },
    { id: 'ACT_MOD08_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD08_VIEW'] }
  ],
  // Payment
  'MOD_09': [
    { id: 'ACT_MOD09_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD09_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD09_VIEW'] },
    { id: 'ACT_MOD09_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD09_VIEW'] },
    { id: 'ACT_MOD09_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD09_VIEW'] }
  ],
  // Legal
  'MOD_15': [
    { id: 'ACT_MOD15_VIEW', name: 'View', description: 'View module records', base: true },
    { id: 'ACT_MOD15_CREATE', name: 'Create', description: 'Create new records', dependencies: ['ACT_MOD15_VIEW'] },
    { id: 'ACT_MOD15_EDIT', name: 'Edit', description: 'Modify existing records', dependencies: ['ACT_MOD15_VIEW'] },
    { id: 'ACT_MOD15_UPLOAD', name: 'Upload Documents', description: 'Upload legal documents', dependencies: ['ACT_MOD15_VIEW'] },
    { id: 'ACT_MOD15_UPDATE_STATUS', name: 'Update Status', description: 'Update record status', dependencies: ['ACT_MOD15_VIEW'] },
    { id: 'ACT_MOD15_EXPORT', name: 'Export', description: 'Export records', dependencies: ['ACT_MOD15_VIEW'] }
  ]
}

export const MOCK_ROLE_ACTION_ACCESS = {
  'ROLE_SYS_08': [ // Sales Exec
    'ACT_MOD02_VIEW', 'ACT_MOD02_CREATE', 'ACT_MOD02_EDIT', 'ACT_MOD02_ASSIGN', 'ACT_MOD02_EXPORT',
    'ACT_MOD03_VIEW', 'ACT_MOD03_CREATE',
    'ACT_MOD04_VIEW', 'ACT_MOD04_CREATE', 'ACT_MOD04_ASSIGN',
    'ACT_MOD06_VIEW',
    'ACT_MOD08_VIEW', 'ACT_MOD08_CREATE'
  ]
}

export const DATA_SCOPE_OPTIONS = [
  { value: 'COMPANY', label: 'Company', description: 'Access records across the entire company.' },
  { value: 'BRANCH', label: 'Branch', description: 'Access records belonging to the user\'s assigned branch.' },
  { value: 'TEAM', label: 'Team', description: 'Access records belonging to the user\'s assigned team.' },
  { value: 'OWN', label: 'Own Records', description: 'Access only records assigned to or created by the user.' }
]

export const MOCK_MODULE_SCOPES = {
  'MOD_01': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Dashboard
  'MOD_02': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Lead CRM
  'MOD_03': ['COMPANY', 'BRANCH'], // Builder Management
  'MOD_04': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Sales Property
  'MOD_05': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Rental
  'MOD_06': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Site Visit
  'MOD_08': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Booking
  'MOD_09': ['COMPANY', 'BRANCH'], // Payment
  'MOD_10': ['COMPANY', 'BRANCH'], // Branch Management
  'MOD_11': ['COMPANY', 'BRANCH'], // Employee Transfer
  'MOD_12': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Attendance
  'MOD_13': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Marketing
  'MOD_14': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Expense
  'MOD_15': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Commission
  'MOD_16': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Legal
  'MOD_17': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Loan
  'MOD_18': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Possession
  'MOD_19': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Customer Support
  'MOD_20': ['COMPANY', 'BRANCH', 'TEAM', 'OWN'], // Reports
  'MOD_22': [], // Mobile App - Not Applicable
  'MOD_23': []  // Integrations - Not Applicable
}

export const MOCK_ROLE_DATA_SCOPE = {
  'ROLE_SYS_08': {
    'MOD_02': 'OWN', // Lead CRM
    'MOD_04': 'BRANCH', // Sales Property
    'MOD_06': 'OWN', // Site Visit
    'MOD_08': 'OWN'  // Booking
  }
}

export const MOCK_APPROVAL_WORKFLOWS = [
  {
    id: 'AWF_01',
    name: 'Discount Request',
    relatedModule: 'MOD_08', // Booking
    description: 'Workflow for approving booking discounts.',
    actions: [
      { id: 'ACT_DR_VIEW', name: 'View Request', base: true },
      { id: 'ACT_DR_FORWARD', name: 'Forward', dependencies: ['ACT_DR_VIEW'] },
      { id: 'ACT_DR_REQ_CHANGES', name: 'Request Changes', dependencies: ['ACT_DR_VIEW'] },
      { id: 'ACT_DR_REJECT', name: 'Reject', dependencies: ['ACT_DR_VIEW'] },
      { id: 'ACT_DR_APPROVE', name: 'Approve', dependencies: ['ACT_DR_VIEW'], authorityRestricted: true } // Only specific roles can approve
    ]
  },
  {
    id: 'AWF_02',
    name: 'Leave Request',
    relatedModule: 'MOD_12', // Attendance
    description: 'Workflow for employee leave applications.',
    actions: [
      { id: 'ACT_LR_VIEW', name: 'View Request', base: true },
      { id: 'ACT_LR_APPROVE', name: 'Approve', dependencies: ['ACT_LR_VIEW'] },
      { id: 'ACT_LR_REJECT', name: 'Reject', dependencies: ['ACT_LR_VIEW'] },
      { id: 'ACT_LR_REQ_CHANGES', name: 'Request Changes', dependencies: ['ACT_LR_VIEW'] },
      { id: 'ACT_LR_REMARKS', name: 'Add Remarks', dependencies: ['ACT_LR_VIEW'] }
    ]
  },
  {
    id: 'AWF_03',
    name: 'Lead Reassignment',
    relatedModule: 'MOD_02', // Lead CRM
    description: 'Workflow for approving lead transfers.',
    actions: [
      { id: 'ACT_LRA_VIEW', name: 'View Request', base: true },
      { id: 'ACT_LRA_APPROVE', name: 'Approve', dependencies: ['ACT_LRA_VIEW'] },
      { id: 'ACT_LRA_REJECT', name: 'Reject', dependencies: ['ACT_LRA_VIEW'] },
      { id: 'ACT_LRA_FORWARD', name: 'Forward', dependencies: ['ACT_LRA_VIEW'] }
    ]
  }
]

export const MOCK_ROLE_APPROVAL_ACCESS = {
  'ROLE_SYS_08': { // Sales Exec
    'AWF_02': ['ACT_LR_VIEW', 'ACT_LR_REMARKS'] // Can view own leave requests
  }
}
