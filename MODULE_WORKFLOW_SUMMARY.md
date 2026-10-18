# 📘 Real Estate CRM — Complete Module Workflow & Role Hierarchy Summary

A single, unified reference explaining how data, permissions, and operational workflows flow across the three tiers of the system:
**Sales Executive** ➔ **Admin (Company Owner / Sub-Admin)** ➔ **Super Admin (Platform Owner)**.

---

## 📑 Table of Contents
1. [System Role Architecture & Multi-Tenancy](#1-system-role-architecture--multi-tenancy)
2. [Visual Hierarchy & Scope of Access](#2-visual-hierarchy--scope-of-access)
3. [Step-by-Step Module Workflows](#3-step-by-step-module-workflows)
   - [3.1 Customer Support & Ticketing Flow](#31-customer-support--ticketing-flow)
   - [3.2 Lead Generation & Customer 360°](#32-lead-generation--customer-360)
   - [3.3 Builders, Projects & Property Inventory](#33-builders-projects--property-inventory)
   - [3.4 Bookings, Unit Hold & Discount Approvals](#34-bookings-unit-hold--discount-approvals)
   - [3.5 Follow-ups, Site Visits & Escalations](#35-follow-ups-site-visits--escalations)
   - [3.6 Attendance & Leave Management](#36-attendance--leave-management)
   - [3.7 End-of-Day (EOD) Daily Productivity Report](#37-end-of-day-eod-daily-productivity-report)
   - [3.8 Post-Booking: Loans, Registration & Possession](#38-post-booking-loans-registration--possession)
   - [3.9 Custom Roles Engine & Permissions (RBAC)](#39-custom-roles-engine--permissions-rbac)
   - [3.10 Firm Onboarding, Subscriptions & Audit Logs](#310-firm-onboarding-subscriptions--audit-logs)
4. [Master Permission & Authority Matrix](#4-master-permission--authority-matrix)
5. [Quick Verification Credentials](#5-quick-verification-credentials)

---

## 1. System Role Architecture & Multi-Tenancy

The CRM is built on a **multi-tenant architecture** with strict data isolation:
- **Tenant Isolation (`firmScope`):** Each real estate company (firm) operates in complete privacy. A user in *Skyline Realty* can never view customers, inventory, or revenue of *Metro Homes*.
- **Role Tiering:** Authority cascades from top to bottom. Decisions made at the bottom requiring business overrides (discounts, leaves, price reductions) flow up to the middle tier for approval. Technical and platform-level support tickets flow directly to the platform top tier.

---

## 2. Visual Hierarchy & Scope of Access

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     SUPER ADMIN (Platform Owner)                         │
│  Scope: Global / Platform-wide (Across all firms)                        │
│  • Onboards firms, manages subscription plans and platform billing       │
│  • Manages Support Ticket Categories, assigns & resolves support tickets │
│  • Global system configuration and platform-wide audit logging           │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ (Multi-tenant Firm Boundary)
┌────────────────────────────────────▼─────────────────────────────────────┐
│              ADMIN / SUB-ADMIN (Company Owner / Branch Mgr)              │
│  Scope: Firm-wide / Branch-wide                                          │
│  • Configures Builders, Projects, Inventory Units, Base Pricing          │
│  • Imports and auto-assigns leads via Round-Robin to team members        │
│  • Action Center: Approves Discount Requests, Leaves, Unit Transfers     │
│  • Monitors team attendance, missed follow-ups, and sales targets        │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ (Portfolio Ownership Scoping)
┌────────────────────────────────────▼─────────────────────────────────────┐
│                 SALES EXECUTIVE (Frontline Sales Agent)                  │
│  Scope: Self-assigned records only                                       │
│  • Manages assigned leads and Customer 360° timelines                    │
│  • Conducts site visits and logs call notes                              │
│  • Checks in via GPS attendance and submits EOD daily report             │
│  • Creates Bookings (with instant unit lock) & raises discount requests   │
│  • Raises platform support tickets                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Module Workflows

### 3.1 Customer Support & Ticketing Flow

This module handles technical assistance, bug reports, and platform requests.

```text
[Sales Executive creates ticket] ──► [Admin views firm's tickets] ──► [Super Admin edits, assigns & resolves]
```

1. **Step 1 (Sales Executive — `/executive/support`):**
   - Frontline agent encounters a system issue or requests help.
   - Clicks **"Create Ticket"**, inputs subject, category (e.g., *Bug*, *Billing*, *Feature*), priority (*Low*, *Medium*, *High*, *Urgent*), and description.
   - Can see the status of their own tickets in the list.
   - **Restriction:** *Cannot change ticket status, cannot assign agents, and cannot delete categories.*
2. **Step 2 (Admin — `/admin/support`):**
   - Admin monitors all tickets created across their entire firm.
   - Can view ticket threads, add internal company notes, and verify if issues have been addressed.
3. **Step 3 (Super Admin — `/super-admin/support/tickets`):**
   - **Full Authority:** Sees all tickets across **every firm on the platform**.
   - Assigns tickets to platform support team members (`/super-admin/support/members`).
   - **Edits ticket state:** Changes status (`Open` ➔ `In Progress` ➔ `Resolved` ➔ `Closed`).
   - Manages ticket categories (`/super-admin/support/categories`).

---

### 3.2 Lead Generation & Customer 360°

1. **Step 1 (Admin / Sub-Admin):**
   - Uploads bulk lead lists via the **4-Step CSV Lead Import Wizard** (Upload ➔ Map Headers ➔ Deduplicate & Validate ➔ Import).
   - Distributes leads to sales staff either manually or using automatic **Round-Robin** assignment.
2. **Step 2 (Sales Executive):**
   - Sees only leads assigned to them under `/executive/leads`.
   - Opens **Customer 360° (`CustomerProfilePage.jsx`)**:
     - Timeline history of interactions.
     - Adds follow-up notes and tags interested projects.
     - Uploads KYC documents (PAN, Aadhaar, Income Proof).
     - Uses the **EMI Calculator Tab** to quote instant payment estimates.
3. **Step 3 (Reassignment Oversight):**
   - If an executive is reassigned or leaves the company, Admin uses **Reassign-Before-Disable** to smoothly transfer active customers without losing lead history.
4. **Step 4 (Super Admin):**
   - Cannot view private customer identities (enforces data confidentiality); only tracks total customer volume analytics across firms.

---

### 3.3 Builders, Projects & Property Inventory

1. **Step 1 (Admin — Catalog Manager):**
   - Creates **Builders** with registered RERA certification numbers, compliance records, and commission rates.
   - Creates **Projects** with towers, wings, launch dates, and brochures.
   - Uploads **Inventory (Units/Flats)**: Defines unit numbers, carpet area, facing direction, base price, and availability (`AVAILABLE`, `HOLD`, `BOOKED`).
2. **Step 2 (Sales Executive — Real-time Catalog):**
   - Browses `/executive/builders` and `/executive/inventory`.
   - Checks live availability of flats while on phone or during customer walkthroughs.
   - **Restriction:** *Read-only access — cannot alter prices or modify unit configurations.*
3. **Step 3 (Super Admin — Governance):**
   - View-only catalog across all firms to monitor RERA compliance and prevent duplicate project registrations across the platform.

---

### 3.4 Bookings, Unit Hold & Discount Approvals

```text
[Executive selects unit] ──► [Instant Double-Booking Lock] ──► [Discount Requested?]
                                                                      │
                         ┌────────────────────────────────────────────┴──────────────────────┐
                         ▼                                                                   ▼
                 [NO DISCOUNT]                                                       [DISCOUNT REQUESTED]
                 Booking Created                                                     Sent to Admin Action Center
                                                                                     (Admin Approves / Rejects)
```

1. **Step 1 (Sales Executive):**
   - Opens `/executive/bookings` and selects an `AVAILABLE` unit.
   - **Double-Booking Hard Lock:** The system initiates a database-level lock. If another agent attempts to select the same unit simultaneously, they receive an immediate `409 Conflict` error.
   - **Discount Negotiation:** If the client requests a price lower than standard, the executive clicks **"Request Discount"**, enters requested rate and justification.
2. **Step 2 (Admin / Sub-Admin — Action Center):**
   - An alert appears in the **Action Center** (`/sub-admin/action`).
   - Admin reviews the requested discount rate vs. builder minimums.
   - Clicks **Approve** (booking confirmed at discounted rate) or **Reject** (original price retained).
3. **Step 3 (Super Admin):**
   - Views aggregate platform revenue and transaction reports.

---

### 3.5 Follow-ups, Site Visits & Escalations

1. **Step 1 (Sales Executive):**
   - Follow-ups are categorized into **Overdue**, **Today**, and **Upcoming**.
   - Executive completes calls, logs client sentiment, and schedules the next action.
   - Creates **Site Visits** choosing customer, project, and time slot.
   - Meets client at site and marks the visit as `CONDUCTED` along with visit remarks.
2. **Step 2 (Admin / Sub-Admin):**
   - If an executive misses a scheduled follow-up past the grace window, the system automatically flags it as `MISSED` and sends an escalation notice to the branch manager.
   - Admin can reassign neglected leads to active executives.

---

### 3.6 Attendance & Leave Management

1. **Step 1 (Sales Executive):**
   - **Morning Check-In:** Opens `/executive/attendance` and clicks **GPS Check-In** (captures real browser coordinates).
   - **Leave Application:** Submits a request under `/executive/leave` (e.g., Casual/Sick leave with dates and reason).
   - **Evening Check-Out:** Clicks **GPS Check-Out** to log working hours.
2. **Step 2 (Admin / Sub-Admin):**
   - Sets the branch office GPS coordinates and geofence radius (e.g., 200m).
   - Reviews daily/monthly attendance logs for team punctuality.
   - Approves or rejects pending leave requests inside the **Action Center**.

---

### 3.7 End-of-Day (EOD) Daily Productivity Report

1. **Step 1 (Sales Executive):**
   - Before logging out, the executive opens `/executive/report`.
   - The backend automatically aggregates that day's live activity:
     - Follow-up calls completed
     - Site visits conducted
     - Bookings closed
     - New leads contacted
   - Executive inputs qualitative notes: challenges faced, pending client questions, tomorrow's plan, then clicks **Submit**.
2. **Step 2 (Admin / Sub-Admin):**
   - Reads daily productivity submissions to evaluate team KPIs and identify underperforming agents.

---

### 3.8 Post-Booking: Loans, Registration & Possession

Once a booking is finalized, the customer enters the post-sales pipeline:

| Phase | Sales Executive Role | Admin / Sub-Admin Role | Super Admin Role |
|---|---|---|---|
| **Home Loans** (`/loans`) | Creates the loan case, uploads customer income slips, tracks bank sanction status. | Coordinates with banking partners, verifies sanction letter, approves disbursement milestones. | High-level compliance and platform audit. |
| **Registration** (`/registration`) | Prepares customer for stamp duty & sets sub-registrar appointment date. | Verifies sale deed agreements, validates payment clearance, uploads final registered deed. | System audit. |
| **Possession** (`/possession`) | Conducts joint flat inspection, fills pre-handover snag checklist with buyer. | Verifies final dues clearance, approves snag sign-off, generates official Key Handover Certificate. | System audit. |

---

### 3.9 Custom Roles Engine & Permissions (RBAC)

1. **Sales Executive:** Operates strictly within their role bounds (`ROLES.SALES_EXECUTIVE`).
2. **Admin:** Can use the **6-Step Role Wizard** (`/admin/roles`) to create custom departmental roles (e.g., *Telecaller*, *Site Specialist*, *Finance Officer*):
   - Step 1: Module Access
   - Step 2: Page & Tab Visibility
   - Step 3: Action Permissions (View, Create, Edit, Delete)
   - Step 4: Data Scope (Self-only, Branch-wide, Firm-wide)
   - Step 5: Approval Authority (Can approve leaves or discounts)
   - Step 6: Review & Save
3. **Super Admin:** Defines the global RBAC schema and defaults in `permissions.js`.

---

### 3.10 Firm Onboarding, Subscriptions & Audit Logs

This area is managed primarily by the top two tiers:

1. **Super Admin (Platform Owner):**
   - Onboards new real estate firms via `/super-admin/firms` (firm profile + initial Admin user created in one step).
   - Activates, suspends, or soft-deletes firms.
   - Manages platform **Subscription Plans & Billing** (`/super-admin/billing`).
   - Inspects the **Master System Audit Log** (`/super-admin/audit`) capturing critical events across all firms.
2. **Admin (Firm Owner):**
   - Views the **Firm Audit Log** (`/admin/audit`), which tracks sensitive actions within their firm (e.g., pricing overrides, user deactivations, booking cancellations).

---

## 4. Master Permission & Authority Matrix

| Module / Action | Sales Executive | Admin (Firm Owner) | Super Admin (Platform) |
|---|:---:|:---:|:---:|
| **Support Tickets** | Create & View Own | View Firm Tickets | **Assign, Edit & Resolve All** |
| **Support Categories** | View only | View only | **Create, Edit & Delete** |
| **Firm Management** | ❌ No access | ❌ No access | **Full Control (CRUD)** |
| **Subscription & Billing**| ❌ No access | View own invoice | **Create Plans & Collect Billing** |
| **User Management** | Profile only | Manage Firm Staff | Manage Firm Admins |
| **Builders & Projects** | View only | **Create, Edit & Archive** | View only (all firms) |
| **Inventory / Units** | View & Hold | **Create, Price & Edit** | View only (all firms) |
| **Leads & Customers** | View/Edit assigned | **Import, Assign & Reassign** | ❌ (Tenant Isolated) |
| **Discount Approvals** | **Request only** | **Approve / Reject** | Macro volume stats |
| **Attendance & Leaves** | **Check-in / Apply** | **Monitor & Approve** | Platform usage stats |
| **EOD Reports** | **Submit Daily** | **Review Team Reports**| Aggregated platform health |
| **Post-Sales Tracking** | Case updates | **Milestone Approvals** | Audit logging |
| **Audit Logs** | ❌ No access | **Own Firm Logs** | **Platform-Wide Audit Logs** |

---

## 5. Quick Verification Credentials

All accounts use the universal password: **`Password@123`**

| Role | Firm | Email | Key Pages to Test |
|---|---|---|---|
| **Super Admin** | Platform System | `superadmin@crm.local` | `/super-admin/firms`, `/super-admin/support/tickets`, `/super-admin/audit` |
| **Admin** | Skyline Realty | `admin@skylinerealty.com` | `/admin/sub-admins`, `/admin/inventory`, `/admin/bookings`, `/admin/roles` |
| **Sub-Admin** | Skyline Realty | `subadmin1@skylinerealty.com` | `/sub-admin/leads/import`, `/sub-admin/action`, `/sub-admin/attendance` |
| **Sales Executive** | Skyline Realty | `exec1@skylinerealty.com` | `/executive`, `/executive/support`, `/executive/bookings`, `/executive/report` |
