import api from './client.js'

// Thin, typed-ish wrappers over the REST API. Each returns the axios promise;
// callers read `res.data.data` (payload) and `res.data.meta` (pagination).
const qs = (params) => {
  const clean = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  )
  const s = new URLSearchParams(clean).toString()
  return s ? `?${s}` : ''
}

export const firmsApi = {
  list: (params) => api.get('/firms', { params }),
  get: (id) => api.get(`/firms/${id}`),
  create: (data) => api.post('/firms', data),
  update: (id, data) => api.patch(`/firms/${id}`, data),
  setStatus: (id, status, reason) => api.patch(`/firms/${id}/status`, { status, reason }),
  restore: (id) => api.patch(`/firms/${id}/restore`),
  bulk: (data) => api.post('/firms/bulk', data),
  remove: (id, permanent) => api.delete(`/firms/${id}${permanent ? '?permanent=true' : ''}`),
}

export const usersApi = {
  list: (params) => api.get(`/users${qs(params)}`),
  stats: () => api.get('/users/stats'),
  get: (id) => api.get(`/users/${id}`),
  create: (body) => api.post('/users', body),
  update: (id, body) => api.patch(`/users/${id}`, body),
  deactivate: (id, reassignTo) => api.patch(`/users/${id}/deactivate`, { reassignTo }),
  activate: (id) => api.patch(`/users/${id}/activate`),
  transfer: (id, body) => api.patch(`/users/${id}/transfer`, body),
}

export const branchesApi = {
  list: (params) => api.get(`/branches${qs(params)}`),
  get: (id) => api.get(`/branches/${id}`),
  comparison: () => api.get('/branches/comparison'),
  create: (body) => api.post('/branches', body),
  update: (id, body) => api.patch(`/branches/${id}`, body),
  setTargets: (id, body) => api.patch(`/branches/${id}/targets`, body),
  setStatus: (id, status) => api.patch(`/branches/${id}/status`, { status }),
  remove: (id) => api.delete(`/branches/${id}`),
}

export const buildersApi = {
  list: (params) => api.get(`/builders${qs(params)}`),
  get: (id) => api.get(`/builders/${id}`),
  create: (body) => api.post('/builders', body),
  update: (id, body) => api.patch(`/builders/${id}`, body),
  archive: (id) => api.delete(`/builders/${id}`),
}

export const projectsApi = {
  list: (params) => api.get(`/projects${qs(params)}`),
  get: (id) => api.get(`/projects/${id}`),
  create: (body) => api.post('/projects', body),
  update: (id, body) => api.patch(`/projects/${id}`, body),
  archive: (id) => api.delete(`/projects/${id}`),
}

export const unitsApi = {
  list: (params) => api.get(`/units${qs(params)}`),
  get: (id) => api.get(`/units/${id}`),
  stats: () => api.get('/units/stats'),
  create: (body) => api.post('/units', body),
  bulk: (body) => api.post('/units/bulk', body),
  update: (id, body) => api.patch(`/units/${id}`, body),
  lock: (id, body) => api.post(`/units/${id}/lock`, body),
  release: (id) => api.post(`/units/${id}/release`),
  transfer: (id, body) => api.post(`/units/${id}/transfer`, body),
}

export const customersApi = {
  list: (params) => api.get(`/customers${qs(params)}`),
  get: (id) => api.get(`/customers/${id}`),
  create: (body) => api.post('/customers', body),
  update: (id, body) => api.patch(`/customers/${id}`, body),
  addNote: (id, body) => api.post(`/customers/${id}/notes`, body),
  addInterest: (id, body) => api.post(`/customers/${id}/interests`, body),
  removeInterest: (id, interestId) => api.delete(`/customers/${id}/interests/${interestId}`),
  uploadDocument: (id, formData) =>
    api.post(`/customers/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changeStatus: (id, body) => api.patch(`/customers/${id}/status`, body),
  reopen: (id) => api.post(`/customers/${id}/reopen`),
  convert: (id) => api.post(`/customers/${id}/convert`),
  assign: (body) => api.post('/customers/assign', body),
  transfer: (id, body) => api.post(`/customers/${id}/transfer`, body),
  distribute: (body) => api.post('/customers/distribute', body),
  import: (body) => api.post('/customers/import', body),
}

// Lead transfer *requests* (Employee spec §Request Lead Transfer). Employees
// create/cancel; sub-admin/admin list the queue and approve/reject.
export const leadTransfersApi = {
  list: (params) => api.get(`/lead-transfers${qs(params)}`),
  create: (body) => api.post('/lead-transfers', body),
  decide: (id, body) => api.patch(`/lead-transfers/${id}`, body),
  cancel: (id) => api.patch(`/lead-transfers/${id}/cancel`),
}

export const followupsApi = {
  list: (params) => api.get(`/followups${qs(params)}`),
  create: (body) => api.post('/followups', body),
  update: (id, body) => api.patch(`/followups/${id}`, body),
  complete: (id, body) => api.patch(`/followups/${id}/complete`, body),
  miss: (id, body) => api.patch(`/followups/${id}/miss`, body),
  reschedule: (id, body) => api.patch(`/followups/${id}/reschedule`, body),
  reassign: (id, assignedTo) => api.patch(`/followups/${id}/reassign`, { assignedTo }),
  cancel: (id, reason) => api.patch(`/followups/${id}/cancel`, { reason }),
}

export const visitsApi = {
  list: (params) => api.get(`/visits${qs(params)}`),
  create: (body) => api.post('/visits', body),
  update: (id, body) => api.patch(`/visits/${id}`, body),
  conduct: (id, body) => api.patch(`/visits/${id}/conduct`, body),
  checkIn: (id, body) => api.patch(`/visits/${id}/check-in`, body),
  checkOut: (id, body) => api.patch(`/visits/${id}/check-out`, body),
  complete: (id, body) => api.patch(`/visits/${id}/complete`, body),
  reschedule: (id, body) => api.patch(`/visits/${id}/reschedule`, body),
  cancel: (id, body) => api.patch(`/visits/${id}/cancel`, body),
  setStatus: (id, status) => api.patch(`/visits/${id}/status`, { status }),
  reassign: (id, assignedTo) => api.patch(`/visits/${id}/reassign`, { assignedTo }),
  flagMissed: (id) => api.patch(`/visits/${id}/flag-missed`),
}

export const bookingsApi = {
  list: (params) => api.get(`/bookings${qs(params)}`),
  get: (id) => api.get(`/bookings/${id}`),
  create: (body) => api.post('/bookings', body),
  update: (id, body) => api.patch(`/bookings/${id}`, body),
  submit: (id) => api.post(`/bookings/${id}/submit`),
  transfer: (id, body) => api.patch(`/bookings/${id}/transfer`, body),
  setStatus: (id, body) => api.patch(`/bookings/${id}/status`, body),
  setMilestone: (id, milestoneId, body) => api.patch(`/bookings/${id}/milestones/${milestoneId}`, body),
  updateDiscount: (id, body) => api.patch(`/bookings/${id}/discount`, body),
  removeDiscount: (id) => api.delete(`/bookings/${id}/discount`),
  requestDiscount: (id, body) => api.post(`/bookings/${id}/discount-request`, body),
  decideDiscount: (id, body) => api.patch(`/bookings/${id}/discount-request`, body),
  requestCancellation: (id, body) => api.post(`/bookings/${id}/cancellation-request`, body),
  decideCancellation: (id, body) => api.patch(`/bookings/${id}/cancellation-request`, body),
  uploadDocument: (id, formData) => api.post(`/bookings/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  addPayment: (id, body) => api.post(`/bookings/${id}/payments`, body),
  updateRegistration: (id, body) => api.patch(`/bookings/${id}/registration`, body),
}

export const commissionsApi = {
  list: () => api.get('/commissions'),
  create: (body) => api.post('/commissions', body),
  update: (id, body) => api.patch(`/commissions/${id}`, body),
  toggle: (id, active) => api.patch(`/commissions/${id}/status`, { active }),
  remove: (id) => api.delete(`/commissions/${id}`),
}

export const tasksApi = {
  list: (params) => api.get(`/tasks${qs(params)}`),
  get: (id) => api.get(`/tasks/${id}`),
  create: (body) => api.post('/tasks', body),
  update: (id, body) => api.patch(`/tasks/${id}`, body),
  setStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  updateProgress: (id, body) => api.patch(`/tasks/${id}/progress`, body),
  complete: (id, body) => api.patch(`/tasks/${id}/complete`, body),
  addComment: (id, body) => api.post(`/tasks/${id}/comments`, body),
  uploadAttachment: (id, formData) => api.post(`/tasks/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`/tasks/${id}`),
}

// Marketing module — tasks + campaigns + analytics (§Marketing Module).
export const marketingApi = {
  config: () => api.get('/marketing/config'),
  dashboard: (params) => api.get(`/marketing/dashboard${qs(params)}`),
  reports: (params) => api.get(`/marketing/reports${qs(params)}`),
  activity: (params) => api.get(`/marketing/activity${qs(params)}`),
  // Tasks
  listTasks: (params) => api.get(`/marketing/tasks${qs(params)}`),
  getTask: (id) => api.get(`/marketing/tasks/${id}`),
  createTask: (body) => api.post('/marketing/tasks', body),
  updateTask: (id, body) => api.patch(`/marketing/tasks/${id}`, body),
  updateProgress: (id, body) => api.patch(`/marketing/tasks/${id}/progress`, body),
  setStatus: (id, body) => api.patch(`/marketing/tasks/${id}/status`, body),
  complete: (id, body) => api.patch(`/marketing/tasks/${id}/complete`, body),
  reopen: (id) => api.patch(`/marketing/tasks/${id}/reopen`),
  reassign: (id, body) => api.patch(`/marketing/tasks/${id}/reassign`, body),
  setDueDate: (id, body) => api.patch(`/marketing/tasks/${id}/due-date`, body),
  addRemark: (id, body) => api.post(`/marketing/tasks/${id}/remarks`, body),
  addLink: (id, body) => api.post(`/marketing/tasks/${id}/links`, body),
  uploadAttachment: (id, formData) => api.post(`/marketing/tasks/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  removeTask: (id) => api.delete(`/marketing/tasks/${id}`),
  // Campaigns
  listCampaigns: (params) => api.get(`/marketing/campaigns${qs(params)}`),
  getCampaign: (id) => api.get(`/marketing/campaigns/${id}`),
  createCampaign: (body) => api.post('/marketing/campaigns', body),
  updateCampaign: (id, body) => api.patch(`/marketing/campaigns/${id}`, body),
  removeCampaign: (id) => api.delete(`/marketing/campaigns/${id}`),
}

// Payment module — customer payment records + receipts + analytics (§Payment Module).
export const paymentsApi = {
  config: () => api.get('/payments/config'),
  dashboard: (params) => api.get(`/payments/dashboard${qs(params)}`),
  reports: (params) => api.get(`/payments/reports${qs(params)}`),
  bookings: () => api.get('/payments/bookings'),
  bookingContext: (bookingId) => api.get(`/payments/booking/${bookingId}/context`),
  list: (params) => api.get(`/payments${qs(params)}`),
  get: (id) => api.get(`/payments/${id}`),
  create: (body) => api.post('/payments', body),
  update: (id, body) => api.patch(`/payments/${id}`, body),
  setStatus: (id, body) => api.patch(`/payments/${id}/status`, body),
  uploadReceipt: (id, formData) => api.post(`/payments/${id}/receipt`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadReceipt: (id) => api.get(`/payments/${id}/receipt/download`),
  remove: (id, reason) => api.delete(`/payments/${id}`, { data: { reason } }),
}

// Expense Management module — expenses + categories + analytics (§Expense Module).
export const expensesApi = {
  config: () => api.get('/expenses/config'),
  dashboard: (params) => api.get(`/expenses/dashboard${qs(params)}`),
  reports: (params) => api.get(`/expenses/reports${qs(params)}`),
  list: (params) => api.get(`/expenses${qs(params)}`),
  get: (id) => api.get(`/expenses/${id}`),
  create: (body) => api.post('/expenses', body),
  update: (id, body) => api.patch(`/expenses/${id}`, body),
  setStatus: (id, body) => api.patch(`/expenses/${id}/status`, body),
  uploadReceipt: (id, formData) => api.post(`/expenses/${id}/receipt`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadReceipt: (id) => api.get(`/expenses/${id}/receipt/download`),
  remove: (id, reason) => api.delete(`/expenses/${id}`, { data: { reason } }),
  // Categories
  categories: () => api.get('/expenses/categories'),
  createCategory: (body) => api.post('/expenses/categories', body),
  updateCategory: (id, body) => api.patch(`/expenses/categories/${id}`, body),
  removeCategory: (id) => api.delete(`/expenses/categories/${id}`),
}

// Legal Management module — post-booking legal cases + documents (§Legal Module).
export const legalApi = {
  config: () => api.get('/legal/config'),
  dashboard: (params) => api.get(`/legal/dashboard${qs(params)}`),
  reports: (params) => api.get(`/legal/reports${qs(params)}`),
  bookings: () => api.get('/legal/bookings'),
  bookingContext: (bookingId) => api.get(`/legal/booking/${bookingId}/context`),
  list: (params) => api.get(`/legal${qs(params)}`),
  get: (id) => api.get(`/legal/${id}`),
  create: (body) => api.post('/legal', body),
  update: (id, body) => api.patch(`/legal/${id}`, body),
  assign: (id, body) => api.patch(`/legal/${id}/assign`, body),
  setStatus: (id, body) => api.patch(`/legal/${id}/status`, body),
  addDocument: (id, body) => api.post(`/legal/${id}/documents`, body),
  updateDocument: (id, docId, body) => api.patch(`/legal/${id}/documents/${docId}`, body),
  uploadDocument: (id, docId, formData) => api.post(`/legal/${id}/documents/${docId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadDocument: (id, docId) => api.get(`/legal/${id}/documents/${docId}/download`),
  remove: (id, reason) => api.delete(`/legal/${id}`, { data: { reason } }),
}

// Sales-Exec End-of-Day (EOD) reports (Sales-Exec flow §E3). Exec submits own;
// sub-admin/admin read the team (firm-scoped).
export const dailyReportsApi = {
  today: (params) => api.get(`/daily-reports/today${qs(params)}`),
  list: (params) => api.get(`/daily-reports${qs(params)}`),
  get: (id) => api.get(`/daily-reports/${id}`),
  submit: (body) => api.post('/daily-reports', body),
}

// Loan tracking module (post-booking home-loan cases).
export const loansApi = {
  list: (params) => api.get(`/loans${qs(params)}`),
  dashboard: () => api.get('/loans/dashboard'),
  reports: () => api.get('/loans/reports'),
  get: (id) => api.get(`/loans/${id}`),
  create: (body) => api.post('/loans', body),
  update: (id, body) => api.patch(`/loans/${id}`, body),
  setStatus: (id, body) => api.patch(`/loans/${id}/status`, body),
  addDocument: (id, body) => api.post(`/loans/${id}/documents`, body),
  updateDocument: (id, docId, body) => api.patch(`/loans/${id}/documents/${docId}`, body),
  remove: (id) => api.delete(`/loans/${id}`),
}

// Registration tracking module (sale-deed / agreement registration).
export const registrationsApi = {
  list: (params) => api.get(`/registrations${qs(params)}`),
  dashboard: () => api.get('/registrations/dashboard'),
  reports: () => api.get('/registrations/reports'),
  get: (id) => api.get(`/registrations/${id}`),
  create: (body) => api.post('/registrations', body),
  update: (id, body) => api.patch(`/registrations/${id}`, body),
  setStatus: (id, body) => api.patch(`/registrations/${id}/status`, body),
  addDocument: (id, body) => api.post(`/registrations/${id}/documents`, body),
  updateDocument: (id, docId, body) => api.patch(`/registrations/${id}/documents/${docId}`, body),
  remove: (id) => api.delete(`/registrations/${id}`),
}

// Possession / handover tracking module.
export const possessionsApi = {
  list: (params) => api.get(`/possessions${qs(params)}`),
  dashboard: () => api.get('/possessions/dashboard'),
  reports: () => api.get('/possessions/reports'),
  get: (id) => api.get(`/possessions/${id}`),
  create: (body) => api.post('/possessions', body),
  update: (id, body) => api.patch(`/possessions/${id}`, body),
  setStatus: (id, body) => api.patch(`/possessions/${id}/status`, body),
  setChecklistItem: (id, itemId, body) => api.patch(`/possessions/${id}/checklist/${itemId}`, body),
  addDocument: (id, body) => api.post(`/possessions/${id}/documents`, body),
  remove: (id) => api.delete(`/possessions/${id}`),
}

// Custom-role engine — role definitions + permission builder + user assignment.
export const rolesApi = {
  list: () => api.get('/roles'),
  get: (id) => api.get(`/roles/${id}`),
  create: (body) => api.post('/roles', body),
  update: (id, body) => api.patch(`/roles/${id}`, body),
  setStatus: (id, status) => api.patch(`/roles/${id}/status`, { status }),
  remove: (id) => api.delete(`/roles/${id}`),
  users: (id) => api.get(`/roles/${id}/users`),
  assignableUsers: () => api.get('/roles/assignable/users'),
  assign: (id, userIds) => api.post(`/roles/${id}/assign`, { userIds }),
  unassign: (id, userIds) => api.post(`/roles/${id}/unassign`, { userIds }),
}

export const leavesApi = {
  list: (params) => api.get(`/leaves${qs(params)}`),
  create: (body) => api.post('/leaves', body),
  cancel: (id) => api.patch(`/leaves/${id}/cancel`),
  uploadAttachment: (id, formData) => api.post(`/leaves/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approve: (id) => api.patch(`/leaves/${id}/approve`),
  reject: (id, note) => api.patch(`/leaves/${id}/reject`, { note }),
}

export const actionCenterApi = {
  summary: () => api.get('/action-center/summary'),
}

export const attendanceApi = {
  checkIn: (location, remarks, photo) => api.post('/attendance/check-in', { location, remarks, photo }),
  checkOut: (location, remarks) => api.post('/attendance/check-out', { location, remarks }),
  me: (params) => api.get(`/attendance/me${qs(params)}`),
  review: (params) => api.get(`/attendance${qs(params)}`),
  submitCorrection: (body) => api.post('/attendance/corrections', body),
  corrections: (params) => api.get(`/attendance/corrections${qs(params)}`),
  decideCorrection: (id, body) => api.patch(`/attendance/corrections/${id}`, body),
}

export const notificationsApi = {
  list: (params) => api.get(`/notifications${qs(params)}`),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications'),
}

export const auditApi = {
  list: (params) => api.get(`/audit-logs${qs(params)}`),
}

export const reportsApi = {
  summary: () => api.get('/reports/summary'),
  adminOverview: () => api.get('/reports/admin-overview'),
  adminRevenueTrend: (period) => api.get(`/reports/admin-revenue-trend${qs({ period })}`),
  subAdminOverview: () => api.get('/reports/sub-admin-overview'),
  myPerformance: (params) => api.get(`/reports/my-performance${qs(params)}`),
  platformOverview: () => api.get('/reports/platform-overview'),
  leadSource: (params) => api.get(`/reports/lead-source${qs(params)}`),
  bookingTrend: (params) => api.get(`/reports/booking-trend${qs(params)}`),
  employeePerformance: () => api.get('/reports/employee-performance'),
  visitConversion: (params) => api.get(`/reports/visit-conversion${qs(params)}`),
  attendance: (params) => api.get(`/reports/attendance${qs(params)}`),
  revenue: (params) => api.get(`/reports/revenue${qs(params)}`),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (body) => api.patch('/settings', body),
  permissions: () => api.get('/settings/permissions'),
}

export const officeSettingsApi = {
  get: () => api.get('/office-settings'),
  update: (body) => api.patch('/office-settings', body),
}

export const companyPreferencesApi = {
  get: () => api.get('/company-preferences'),
  update: (body) => api.patch('/company-preferences', body),
}

export const companyNotificationsApi = {
  get: () => api.get('/company-notifications'),
  update: (body) => api.patch('/company-notifications', body),
}

export const companySecurityApi = {
  get: () => api.get('/company-security'),
  update: (body) => api.patch('/company-security', body),
}

export const companyBrandingApi = {
  get: () => api.get('/company-branding'),
  update: (body) => api.patch('/company-branding', body),
  uploadLogo: (formData) => api.post('/company-branding/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadFavicon: (formData) => api.post('/company-branding/favicon', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export const companyBusinessConfigApi = {
  get: () => api.get('/company-business-config'),
  update: (body) => api.patch('/company-business-config', body),
}

export const activeSessionsApi = {
  list: () => api.get('/active-sessions'),
  revoke: (id) => api.delete(`/active-sessions/${id}`),
}

export const masterDataApi = {
  list: (category) => api.get(`/master-data/${category}`),
  create: (category, body) => api.post(`/master-data/${category}`, body),
  update: (category, id, body) => api.patch(`/master-data/${category}/${id}`, body),
  setStatus: (category, id, active) => api.patch(`/master-data/${category}/${id}/status`, { active }),
}

export const branchSettingsApi = {
  get: () => api.get('/branch-settings'),
  update: (body) => api.patch('/branch-settings', body),
}

export const ticketCategoriesApi = {
  list: () => api.get('/tickets/categories'),
  create: (body) => api.post('/tickets/categories', body),
  update: (id, body) => api.patch(`/tickets/categories/${id}`, body),
  toggle: (id, isActive) => api.patch(`/tickets/categories/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/tickets/categories/${id}`),
}

export const ticketsApi = {
  list: (params) => api.get(`/tickets${qs(params)}`),
  get: (id) => api.get(`/tickets/${id}`),
  create: (body) => api.post('/tickets', body),
  update: (id, body) => api.patch(`/tickets/${id}`, body),
  changeStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  assign: (id, assignedTo) => api.patch(`/tickets/${id}/assign`, { assignedTo }),
  addNote: (id, note) => api.post(`/tickets/${id}/notes`, { note }),
}

export const supportMembersApi = {
  list: () => api.get('/tickets/members'),
  create: (body) => api.post('/tickets/members', body),
  update: (id, body) => api.patch(`/tickets/members/${id}`, body),
  toggle: (id, isActive) => api.patch(`/tickets/members/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/tickets/members/${id}`),
}

export const announcementsApi = {
  list: (params) => api.get('/announcements', { params }),
  get: (id) => api.get(`/announcements/${id}`),
  create: (body) => api.post('/announcements', body),
  update: (id, body) => api.patch(`/announcements/${id}`, body),
  remove: (id) => api.delete(`/announcements/${id}`),
}

export const notificationHistoryApi = {
  list: (params) => api.get('/announcements/history', { params }),
}

// Super Admin subscription & billing (live data).
export const billingApi = {
  overview: () => api.get('/billing/overview'),
  plans: () => api.get('/billing/plans'),
  getPlan: (id) => api.get(`/billing/plans/${id}`),
  createPlan: (body) => api.post('/billing/plans', body),
  updatePlan: (id, body) => api.patch(`/billing/plans/${id}`, body),
  removePlan: (id) => api.delete(`/billing/plans/${id}`),
  subscriptions: () => api.get('/billing/subscriptions'),
  getSubscription: (id) => api.get(`/billing/subscriptions/${id}`),
  invoices: () => api.get('/billing/invoices'),
  transactions: () => api.get('/billing/transactions'),
  settings: () => api.get('/billing/settings'),
  updateSettings: (body) => api.patch('/billing/settings', body),
  downloadInvoice: (id) => api.get(`/billing/invoices/${id}/download`, { responseType: 'text' }),
  emailInvoice: (id) => api.post(`/billing/invoices/${id}/email`),
  retryPayment: (subscriptionId) => api.post(`/billing/subscriptions/${subscriptionId}/retry`),
}
