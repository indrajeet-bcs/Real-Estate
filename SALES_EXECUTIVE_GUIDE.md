# Sales Executive Module — Developer Onboarding & Architecture Guide

Welcome! This document provides a complete, clear, and easy-to-understand explanation of the **Sales Executive (Field/Desk Agent)** flow, file structure, and technical workflows in this Real Estate CRM.

---

## 1. High-Level Role Overview

A **Sales Executive** is an on-ground or tele-calling agent who handles day-to-day sales operations:
- **Scope of Data:** Strictly scoped to **their own assigned records** (leads, customers, follow-ups, visits, bookings) within their company firm.
- **Primary Goal:** Convert leads into buyers, conduct site visits, close property bookings, and log daily performance.

```
       ┌─────────────────────────────────────────────────────────────┐
       │                 SALES EXECUTIVE DAILY FLOW                   │
       └─────────────────────────────────────────────────────────────┘
                                      │
 1. MORNING ATTENDANCE ───────────────┼──► GPS Check-in (Office/Site)
                                      │
 2. REVIEW TASKS & LEADS ─────────────┼──► Check Dashboard / Pending Tasks / Leads
                                      │
 3. CLIENT ENGAGEMENT ────────────────┼──► Log Calls & Reschedule Follow-ups
                                      │
 4. SITE VISITS ──────────────────────┼──► Conduct or Schedule Property Visits
                                      │
 5. INVENTORY & BOOKING ──────────────┼──► Check Available Units & Block Unit
                                      │    (Optional: Request Discount Override)
                                      │
 6. POST-BOOKING LIFECYCLE ───────────┼──► Payments, Loan Assist, Possession
                                      │
 7. EVENING WRAP-UP ──────────────────┴──► Submit EOD Daily Report & Check-out
```

---

## 2. Directory & File Structure

### Frontend (`my-app/src/`)

All Sales Executive screens are routed under `/executive/*` and rendered inside the standard responsive layout (`DashboardLayout.jsx`).

| Route | File Path | Purpose |
|---|---|---|
| `/executive` | `pages/executive/ExecutiveHome.jsx` | Dashboard KPIs, today's schedule, quick action cards |
| `/executive/leads` | `pages/executive/MyLeadsPage.jsx` | View and manage newly assigned leads |
| `/executive/customers` | `pages/executive/MyCustomersPage.jsx` | All assigned clients & pipeline stages |
| `/executive/customers/:id` | `pages/customers/CustomerProfilePage.jsx` | **Customer 360°** (timeline, notes, docs, EMI planner) |
| `/executive/pipeline` | `pages/executive/PipelinePage.jsx` | Visual conversion funnel & lead source distribution |
| `/executive/builders` | `pages/executive/BuildersDirectoryPage.jsx` | Approved builders, projects, RERA numbers & commissions |
| `/executive/inventory` | `pages/executive/MyInventoryPage.jsx` | Search real-time available units, flats & pricing |
| `/executive/followups` | `pages/executive/MyFollowUpsPage.jsx` | Today's calls/meetings, complete, reschedule, or log notes |
| `/executive/visits` | `pages/executive/MyVisitsPage.jsx` | Scheduled client site visits, conduct or mark outcome |
| `/executive/bookings` | `pages/executive/MyBookingsPage.jsx` | Create booking, unit selection, request discount approval |
| `/executive/payments` | `pages/payments/PaymentsPage.jsx` | Payment records associated with assigned bookings |
| `/executive/loans` | `pages/loans/*` | Assist client loan application cases |
| `/executive/registration`| `pages/registration/*` | Track stamp duty, registration & appointment |
| `/executive/possession` | `pages/possession/*` | Unit handover checklist & key handover status |
| `/executive/tasks` | `pages/executive/MyTasksPage.jsx` | General to-dos and action items |
| `/executive/attendance` | `pages/executive/MyAttendancePage.jsx` | Real GPS check-in/check-out with monthly log |
| `/executive/leave` | `pages/executive/MyLeavePage.jsx` | Apply for casual/sick leaves to Sub-Admin |
| `/executive/report` | `pages/executive/DailyReportPage.jsx` | Auto-computed End-of-Day (EOD) work report submission |
| `/executive/performance`| `pages/executive/MyPerformancePage.jsx` | Target vs. achievement KPIs & conversion rates |
| `/executive/profile` | `pages/executive/ExecutiveProfile.jsx` | Executive profile settings, attendance summary |

---

### Backend (`server/src/`)

| Controller / Route | Associated Model | Key Responsibility |
|---|---|---|
| `controllers/customer.controller.js` | `Customer.js` | Customer CRUD; `firmScope` + assigned executive filtering |
| `controllers/followup.controller.js` | `FollowUp.js` | Schedule follow-up, mark done, auto-escalate missed ones |
| `controllers/visit.controller.js` | `Visit.js` | Site visit scheduling, status updates (conducted/missed) |
| `controllers/booking.controller.js` | `Booking.js` | Booking creation with **Double-Booking hard lock**, discount request |
| `controllers/dailyReport.controller.js` | `DailyReport.js` | Generates prefilled summary of day's calls/visits/bookings |
| `controllers/attendance.controller.js` | `Attendance.js` | GPS coordinates validation for daily attendance |
| `controllers/leave.controller.js` | `Leave.js` | Create and track leave approvals |

---

## 3. Core Business Workflows Explained

### A. Lead to Customer (Unified Model)
* **Design Decision:** There is **no separate Lead table**. A Lead is simply a `Customer` with early statuses (`NEW`, `CONTACTED`, `INTERESTED`).
* Moving a client from lead to buyer happens on the same record without data loss or duplication.
* **Customer 360° (`CustomerProfilePage.jsx`):** Allows the executive to see the full timeline, add call notes, attach KYC documents, and use the built-in **EMI Calculator Tab** to quote estimates directly to the customer.

### B. Follow-ups & Escalation Engine
1. Executive sees follow-ups grouped: **Overdue**, **Today**, and **Upcoming**.
2. When completing a call, executive logs notes and can immediately schedule the next follow-up.
3. If missed past the grace deadline, system flags it as `MISSED` and notifies the branch Sub-Admin.

### C. Site Visit Lifecycle
1. Executive creates a Site Visit request choosing the Customer, Project, and Date/Time.
2. After meeting the customer at the site, status changes to `CONDUCTED` along with client feedback (e.g., *Budget mismatch*, *Liked 2BHK Tower A*).

### D. Booking Flow & Double-Booking Protection
1. Executive opens **New Booking**, selects customer and project.
2. Selects an **Available Unit** from inventory.
3. **Double-Booking hard lock:** The database and booking transaction explicitly verify unit availability. If another agent booked or placed a hold on the unit seconds prior, a 409 Conflict is returned immediately.
4. **Discount Requests:** If the client demands a rate below standard pricing, the executive clicks **"Request Discount"**. This creates an approval request visible in Sub-Admin's **Action Center**.

### E. EOD (End of Day) Daily Report
1. Executive navigates to `/executive/report` before leaving.
2. The system auto-aggregates the day's real metrics:
   - Calls completed today
   - Site visits conducted today
   - Bookings created
   - New leads engaged
3. Executive adds remarks, challenges faced, and submits the report for manager review.

---

## 4. Security & Permissions (RBAC)

- Handled in `server/src/config/permissions.js` and `my-app/src/lib/constants.js`.
- The Sales Executive role is `ROLES.SALES_EXECUTIVE` (Value: `'sales_executive'`).
- The backend middleware `authenticate` and `firmScope(req.user)` ensure:
  1. No cross-firm data access (tenancy isolation).
  2. Data queries automatically append `{ assignedTo: req.user._id }` so executives only see their own portfolio.

---

## 5. Quick Start for Developers

### Run Locally:
```bash
# 1. Start Backend
cd server
npm install
npm run seed:demo      # Populates test firms, inventory, and executives
npm run dev            # Runs on http://localhost:5000

# 2. Start Frontend
cd ../my-app
npm install
npm run dev            # Runs on http://localhost:5173
```

### Ready-to-Use Demo Credentials:
All demo accounts use password: **`Password@123`**

| Role | Email |
|---|---|
| Sales Executive 1 (Skyline Realty) | `exec1@skylinerealty.com` |
| Sales Executive 2 (Skyline Realty) | `exec2@skylinerealty.com` |
| Branch Sub-Admin (Manager) | `subadmin1@skylinerealty.com` |
