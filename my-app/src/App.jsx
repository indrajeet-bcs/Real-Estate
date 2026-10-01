import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import { ROLES } from './lib/constants.js'

// Auth
import LoginPage from './pages/auth/LoginPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

// Dashboards
import SuperAdminDashboard from './pages/dashboards/SuperAdminDashboard.jsx'
import AdminDashboard from './pages/dashboards/AdminDashboard.jsx'
import SubAdminDashboard from './pages/dashboards/SubAdminDashboard.jsx'

// Shared feature pages
import CustomersListPage from './pages/customers/CustomersListPage.jsx'
import CustomerProfilePage from './pages/customers/CustomerProfilePage.jsx'
import EmployeesPage from './pages/users/EmployeesPage.jsx'
import BuildersPage from './pages/catalog/BuildersPage.jsx'
import ProjectsPage from './pages/catalog/ProjectsPage.jsx'
import ReportsPage from './pages/reports/ReportsPage.jsx'
import RevenuePage from './pages/reports/RevenuePage.jsx'
import MarketingPage from './pages/marketing/MarketingPage.jsx'
import PaymentsPage from './pages/payments/PaymentsPage.jsx'
import ExpensesPage from './pages/expenses/ExpensesPage.jsx'
import LegalPage from './pages/legal/LegalPage.jsx'
import CustomerSupportPage from './pages/support/CustomerSupportPage.jsx'

// Loans
import LoansDashboard from './pages/loans/LoansDashboard.jsx'
import LoanCasesList from './pages/loans/LoanCasesList.jsx'
import CreateLoanCase from './pages/loans/CreateLoanCase.jsx'
import LoanDetails from './pages/loans/LoanDetails.jsx'
import LoanReports from './pages/loans/LoanReports.jsx'

// Registration
import RegistrationDashboard from './pages/registration/RegistrationDashboard.jsx'
import RegistrationCasesList from './pages/registration/RegistrationCasesList.jsx'
import CreateRegistrationCase from './pages/registration/CreateRegistrationCase.jsx'
import RegistrationDetails from './pages/registration/RegistrationDetails.jsx'
import RegistrationReports from './pages/registration/RegistrationReports.jsx'

// Possession
import PossessionDashboard from './pages/possession/PossessionDashboard.jsx'
import PossessionCasesList from './pages/possession/PossessionCasesList.jsx'
import CreatePossessionCase from './pages/possession/CreatePossessionCase.jsx'
import PossessionDetails from './pages/possession/PossessionDetails.jsx'
import PossessionReports from './pages/possession/PossessionReports.jsx'

// Executive
import SubAdminVisitsPage from './pages/subadmin/SubAdminVisitsPage.jsx'
import SubAdminFollowUpsPage from './pages/subadmin/SubAdminFollowUpsPage.jsx'
import ProfileSettingsPage from './pages/ProfileSettingsPage.jsx'
import SubAdminAuditLogsPage from './pages/subadmin/SubAdminAuditLogsPage.jsx'
import PendingTasksPage from './pages/executive/PendingTasksPage.jsx'
import ExecutiveHome from './pages/executive/ExecutiveHome.jsx'
import ExecutiveProfile from './pages/executive/ExecutiveProfile.jsx'
import MyLeadsPage from './pages/executive/MyLeadsPage.jsx'
import MyCustomersPage from './pages/executive/MyCustomersPage.jsx'
import MyVisitsPage from './pages/executive/MyVisitsPage.jsx'
import MyBookingsPage from './pages/executive/MyBookingsPage.jsx'
import MyFollowUpsPage from './pages/executive/MyFollowUpsPage.jsx'
import MyTasksPage from './pages/executive/MyTasksPage.jsx'
import MyAttendancePage from './pages/executive/MyAttendancePage.jsx'
import MyLeavePage from './pages/executive/MyLeavePage.jsx'
import MyPerformancePage from './pages/executive/MyPerformancePage.jsx'
import MyInventoryPage from './pages/executive/MyInventoryPage.jsx'
import BuildersDirectoryPage from './pages/executive/BuildersDirectoryPage.jsx'
import PipelinePage from './pages/executive/PipelinePage.jsx'
import DailyReportPage from './pages/executive/DailyReportPage.jsx'

// Sub-Admin
import LeadImportPage from './pages/subadmin/LeadImportPage.jsx'
import AssignLeadsPage from './pages/subadmin/AssignLeadsPage.jsx'
import SubAdminLeadsPage from './pages/subadmin/SubAdminLeadsPage.jsx'
import AttendanceReviewPage from './pages/subadmin/AttendanceReviewPage.jsx'
import AttendanceLeavesPage from './pages/subadmin/AttendanceLeavesPage.jsx'
import SalesTeamPage from './pages/subadmin/SalesTeamPage.jsx'
import SubAdminEmployeesPage from './pages/subadmin/SubAdminEmployeesPage.jsx'
import ActionCenterPage from './pages/subadmin/ActionCenterPage.jsx'
import BranchSettingsPage from './pages/subadmin/BranchSettingsPage.jsx'

// Admin (Company Owner)
import AdminProfilePage from './pages/admin/AdminProfilePage.jsx'
import BranchesPage from './pages/admin/BranchesPage.jsx'
import BranchDetailsPage from './pages/admin/BranchDetailsPage.jsx'
import AdminEmployeesPage from './pages/admin/AdminEmployeesPage.jsx'
import AdminEmployeeDetailsPage from './pages/admin/AdminEmployeeDetailsPage.jsx'
import InventoryPage from './pages/admin/InventoryPage.jsx'
import UnitDetailsPage from './pages/admin/UnitDetailsPage.jsx'
import BuilderDetailsPage from './pages/admin/BuilderDetailsPage.jsx'
import ProjectDetailsPage from './pages/admin/ProjectDetailsPage.jsx'
import LeadsPage from './pages/admin/LeadsPage.jsx'
import AdminBookingsPage from './pages/admin/AdminBookingsPage.jsx'
import BookingDetailsPage from './pages/admin/BookingDetailsPage.jsx'
import CommissionsPage from './pages/admin/CommissionsPage.jsx'
import OfficeSettingsPage from './pages/admin/OfficeSettingsPage.jsx'
import RolesManagementPage from './pages/admin/RolesManagementPage.jsx'
import RoleDetailsPage from './pages/admin/RoleDetailsPage.jsx'
import ModuleAccessPage from './pages/admin/ModuleAccessPage.jsx'
import PageTabAccessPage from './pages/admin/PageTabAccessPage.jsx'
import ActionPermissionsPage from './pages/admin/ActionPermissionsPage.jsx'
import DataScopePage from './pages/admin/DataScopePage.jsx'
import ApprovalPermissionsPage from './pages/admin/ApprovalPermissionsPage.jsx'
import ReviewSavePage from './pages/admin/ReviewSavePage.jsx'
import ReportsVaultPage from './pages/admin/ReportsVaultPage.jsx'

// Super Admin
import FirmsPage from './pages/superadmin/FirmsPage.jsx'
import FirmDetailsPage from './pages/superadmin/FirmDetailsPage.jsx'
import AuditLogsPage from './pages/superadmin/AuditLogsPage.jsx'
import PermissionsPage from './pages/superadmin/PermissionsPage.jsx'
import SettingsPage from './pages/superadmin/SettingsPage.jsx'
import PlatformSettingsPage from './pages/superadmin/PlatformSettingsPage.jsx'
import SuperAdminReportsPage from './pages/superadmin/SuperAdminReportsPage.jsx'
import SuperAdminProfilePage from './pages/superadmin/SuperAdminProfilePage.jsx'

// Super Admin — Support Center
import SupportTicketsPage from './pages/superadmin/support/SupportTicketsPage.jsx'
import SupportMembersPage from './pages/superadmin/support/SupportMembersPage.jsx'
import TicketCategoriesPage from './pages/superadmin/support/TicketCategoriesPage.jsx'

// Super Admin — Announcements
import AnnouncementsPage from './pages/superadmin/announcements/AnnouncementsPage.jsx'
import NotificationHistoryPage from './pages/superadmin/announcements/NotificationHistoryPage.jsx'

// Super Admin — Subscription & Billing
import BillingDashboardPage from './pages/superadmin/billing/BillingDashboardPage.jsx'
import SubscriptionPlansPage from './pages/superadmin/billing/SubscriptionPlansPage.jsx'
import PlanDetailPage from './pages/superadmin/billing/PlanDetailPage.jsx'
import EditPlanPage from './pages/superadmin/billing/EditPlanPage.jsx'
import BillingPage from './pages/superadmin/billing/BillingPage.jsx'
import BillingDetailPage from './pages/superadmin/billing/BillingDetailPage.jsx'
import InvoicesPage from './pages/superadmin/billing/InvoicesPage.jsx'
import TransactionsPage from './pages/superadmin/billing/TransactionsPage.jsx'
import BillingSettingsPage from './pages/superadmin/billing/BillingSettingsPage.jsx'

function shell(role) {
  return (
    <ProtectedRoute roles={[role]}>
      <DashboardLayout />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Super Admin */}
            <Route path="/super-admin" element={shell(ROLES.SUPER_ADMIN)}>
              <Route index element={<SuperAdminDashboard />} />
              <Route path="profile" element={<SuperAdminProfilePage />} />
              <Route path="firms" element={<FirmsPage />} />
              <Route path="firms/:id" element={<FirmDetailsPage />} />
              <Route path="builders" element={<BuildersPage readOnly />} />
              <Route path="projects" element={<ProjectsPage readOnly />} />
              <Route path="reports" element={<SuperAdminReportsPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="platform-settings" element={<PlatformSettingsPage />} />
              <Route path="permissions" element={<PermissionsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {/* Support Center */}
              <Route path="support/tickets" element={<SupportTicketsPage />} />
              <Route path="support/members" element={<SupportMembersPage />} />
              <Route path="support/categories" element={<TicketCategoriesPage />} />
              {/* Announcements */}
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="announcements/history" element={<NotificationHistoryPage />} />
              {/* Subscription & Billing */}
              <Route path="billing" element={<BillingDashboardPage />} />
              <Route path="billing/plans" element={<SubscriptionPlansPage />} />
              <Route path="billing/plans/:id" element={<PlanDetailPage />} />
              <Route path="billing/plans/:id/edit" element={<EditPlanPage />} />
              <Route path="billing/records" element={<BillingPage />} />
              <Route path="billing/records/:id" element={<BillingDetailPage />} />
              <Route path="billing/invoices" element={<InvoicesPage />} />
              <Route path="billing/transactions" element={<TransactionsPage />} />
              <Route path="billing/settings" element={<BillingSettingsPage />} />
            </Route>

            {/* Admin (Company Owner) — grouped consoles ported in phases.
                Net-new consoles are stubbed; existing pages stay mounted for interim access. */}
            <Route path="/admin" element={shell(ROLES.ADMIN)}>
              <Route index element={<AdminDashboard />} />

              {/* Consoles */}
              <Route path="branches" element={<BranchesPage />} />
              <Route path="branches/:id" element={<BranchDetailsPage />} />
              <Route path="employees" element={<AdminEmployeesPage />} />
              <Route path="employees/:id" element={<AdminEmployeeDetailsPage />} />

              {/* Inventory & KYC */}
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="inventory/units/:id" element={<UnitDetailsPage />} />
              <Route path="inventory/builders/:id" element={<BuilderDetailsPage />} />
              <Route path="inventory/projects/:id" element={<ProjectDetailsPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="leads/:id" element={<CustomerProfilePage />} />
              <Route path="buyers/:id" element={<CustomerProfilePage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="bookings/:id" element={<BookingDetailsPage />} />

              {/* Marketing */}
              <Route path="marketing" element={<MarketingPage title="Marketing" subtitle="Plan, assign and track online & offline marketing across the company." />} />
              <Route path="payments" element={<PaymentsPage title="Payments" subtitle="Record and manage all customer payments received after booking." />} />
              <Route path="expenses" element={<ExpensesPage title="Expense Management" subtitle="Record, track, verify and analyze company expenses." />} />
              <Route path="legal" element={<LegalPage title="Legal Management" subtitle="Track document collection, verification and agreements until registration." />} />
              <Route path="support" element={<CustomerSupportPage />} />

              {/* Overrides & Finance */}
              <Route path="commissions" element={<CommissionsPage />} />
              <Route path="loans">
                <Route index element={<LoansDashboard />} />
                <Route path="cases" element={<LoanCasesList />} />
                <Route path="create" element={<CreateLoanCase />} />
                <Route path="reports" element={<LoanReports />} />
                <Route path=":id" element={<LoanDetails />} />
              </Route>
              <Route path="registration">
                <Route index element={<RegistrationDashboard />} />
                <Route path="cases" element={<RegistrationCasesList />} />
                <Route path="create" element={<CreateRegistrationCase />} />
                <Route path="reports" element={<RegistrationReports />} />
                <Route path=":id" element={<RegistrationDetails />} />
              </Route>
              <Route path="possession">
                <Route index element={<PossessionDashboard />} />
                <Route path="cases" element={<PossessionCasesList />} />
                <Route path="create" element={<CreatePossessionCase />} />
                <Route path="reports" element={<PossessionReports />} />
                <Route path=":id" element={<PossessionDetails />} />
              </Route>
              <Route path="reports" element={<ReportsVaultPage />} />
              <Route path="settings" element={<OfficeSettingsPage />} />
              <Route path="roles">
                <Route index element={<RolesManagementPage />} />
                <Route path=":id" element={<RoleDetailsPage />} />
                <Route path=":id/permissions" element={<ModuleAccessPage />} />
                <Route path=":id/permissions/pages" element={<PageTabAccessPage />} />
                <Route path=":id/permissions/actions" element={<ActionPermissionsPage />} />
                <Route path=":id/permissions/scope" element={<DataScopePage />} />
                <Route path=":id/permissions/approvals" element={<ApprovalPermissionsPage />} />
                <Route path=":id/permissions/review" element={<ReviewSavePage />} />
              </Route>

              {/* Account */}
              <Route path="profile" element={<AdminProfilePage />} />

              {/* Interim: existing pages kept mounted during the phased migration */}
              <Route path="sub-admins" element={<EmployeesPage role={ROLES.SUB_ADMIN} title="Sub-Admin Management" subtitle="Create and manage sub-admins (§4)" />} />
              <Route path="builders" element={<BuildersPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="clients" element={<CustomersListPage title="All Clients" subtitle="Firm-wide customer history (§4)" basePath="/admin/clients" />} />
              <Route path="clients/:id" element={<CustomerProfilePage />} />
              <Route path="revenue" element={<RevenuePage />} />
            </Route>

            {/* Sub-Admin (Branch Admin) — grouped consoles ported in phases.
                Net-new consoles are stubbed; existing pages stay mounted. */}
            <Route path="/sub-admin" element={shell(ROLES.SUB_ADMIN)}>
              <Route index element={<SubAdminDashboard />} />
              <Route path="action" element={<ActionCenterPage />} />
              <Route path="team" element={<SalesTeamPage />} />
              <Route path="employees" element={<SubAdminEmployeesPage />} />
              <Route path="leads" element={<SubAdminLeadsPage />} />
              <Route path="leads/import" element={<LeadImportPage />} />
              <Route path="leads/assign" element={<AssignLeadsPage />} />
              <Route path="customers" element={<CustomersListPage title="Customer Monitoring" subtitle="Team-wide pipeline (§5)" basePath="/sub-admin/customers" />} />
              <Route path="customers/:id" element={<CustomerProfilePage />} />
              <Route path="inventory" element={<InventoryPage title="Inventory / Unit Management" subtitle="Manage units, availability, holds, transfers and property lifecycle." basePath="/sub-admin/inventory" bookingsPath="/sub-admin/bookings" />} />
              <Route path="inventory/units/:id" element={<UnitDetailsPage />} />
              <Route path="inventory/builders/:id" element={<BuilderDetailsPage />} />
              <Route path="inventory/projects/:id" element={<ProjectDetailsPage />} />
              <Route path="attendance" element={<AttendanceLeavesPage />} />
              <Route path="followups" element={<SubAdminFollowUpsPage />} />
              <Route path="visits" element={<SubAdminVisitsPage />} />
              <Route path="bookings" element={<AdminBookingsPage basePath="/sub-admin/bookings" title="Bookings" subtitle="Manage branch bookings, payments, discounts, transfers and registration." />} />
              <Route path="bookings/:id" element={<BookingDetailsPage />} />
              <Route path="marketing" element={<MarketingPage title="Marketing" subtitle="Assign & track your branch's online & offline marketing." />} />
              <Route path="payments" element={<PaymentsPage title="Payments" subtitle="Record and manage branch customer payments." />} />
              <Route path="expenses" element={<ExpensesPage title="Expense Management" subtitle="Record, track and analyze branch expenses." />} />
              <Route path="legal" element={<LegalPage title="Legal Management" subtitle="Track branch legal cases, documents and agreements." />} />
              <Route path="loans">
                <Route index element={<LoansDashboard />} />
                <Route path="cases" element={<LoanCasesList />} />
                <Route path="create" element={<CreateLoanCase />} />
                <Route path="reports" element={<LoanReports />} />
                <Route path=":id" element={<LoanDetails />} />
              </Route>
              <Route path="registration">
                <Route index element={<RegistrationDashboard />} />
                <Route path="cases" element={<RegistrationCasesList />} />
                <Route path="create" element={<CreateRegistrationCase />} />
                <Route path="reports" element={<RegistrationReports />} />
                <Route path=":id" element={<RegistrationDetails />} />
              </Route>
              <Route path="possession">
                <Route index element={<PossessionDashboard />} />
                <Route path="cases" element={<PossessionCasesList />} />
                <Route path="create" element={<CreatePossessionCase />} />
                <Route path="reports" element={<PossessionReports />} />
                <Route path=":id" element={<PossessionDetails />} />
              </Route>
              <Route path="support" element={<CustomerSupportPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<BranchSettingsPage />} />
              <Route path="audit" element={<SubAdminAuditLogsPage />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
            </Route>

            {/* Sales Executive — standard responsive dashboard shell (sidebar on
                desktop, off-canvas drawer on mobile), matching the other roles. */}
            <Route path="/executive" element={shell(ROLES.SALES_EXECUTIVE)}>
              <Route index element={<ExecutiveHome />} />
              <Route path="leads" element={<MyLeadsPage />} />
              <Route path="leads/:id" element={<CustomerProfilePage />} />
              <Route path="customers" element={<MyCustomersPage />} />
              <Route path="customers/:id" element={<CustomerProfilePage />} />
              <Route path="builders" element={<BuildersDirectoryPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="profile" element={<ExecutiveProfile />} />
              <Route path="report" element={<DailyReportPage />} />
              <Route path="followups" element={<MyFollowUpsPage />} />
              <Route path="visits" element={<MyVisitsPage />} />
              <Route path="bookings" element={<MyBookingsPage />} />
              <Route path="inventory" element={<MyInventoryPage />} />
              <Route path="tasks" element={<MyTasksPage />} />
              <Route path="marketing" element={<MarketingPage title="Marketing" subtitle="Create and track your marketing tasks." />} />
              <Route path="payments" element={<PaymentsPage title="Payments" subtitle="Customer payments for your assigned bookings." />} />
              <Route path="expenses" element={<ExpensesPage title="Expenses" subtitle="Record and track your expenses." />} />
              <Route path="legal" element={<LegalPage title="Legal Status" subtitle="Legal progress for your assigned customers." />} />
              <Route path="loans">
                <Route index element={<LoansDashboard />} />
                <Route path="cases" element={<LoanCasesList />} />
                <Route path="create" element={<CreateLoanCase />} />
                <Route path="reports" element={<LoanReports />} />
                <Route path=":id" element={<LoanDetails />} />
              </Route>
              <Route path="registration">
                <Route index element={<RegistrationDashboard />} />
                <Route path="cases" element={<RegistrationCasesList />} />
                <Route path="create" element={<CreateRegistrationCase />} />
                <Route path="reports" element={<RegistrationReports />} />
                <Route path=":id" element={<RegistrationDetails />} />
              </Route>
              <Route path="possession">
                <Route index element={<PossessionDashboard />} />
                <Route path="cases" element={<PossessionCasesList />} />
                <Route path="create" element={<CreatePossessionCase />} />
                <Route path="reports" element={<PossessionReports />} />
                <Route path=":id" element={<PossessionDetails />} />
              </Route>
              <Route path="support" element={<CustomerSupportPage />} />
              <Route path="attendance" element={<MyAttendancePage />} />
              <Route path="leave" element={<MyLeavePage />} />
              <Route path="performance" element={<MyPerformancePage />} />
              <Route path="pending-tasks" element={<PendingTasksPage />} />
            </Route>

            {/* Default */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
