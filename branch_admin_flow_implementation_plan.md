# Branch Admin (Sub-Admin) Flow — Port & Implementation Plan

## Source
Porting the **Branch Admin portal** from `rera-saas-admin-portal` (`BranchAdminPortal.tsx`
+ `branch/` views) into the CRM's **Sub-Admin** role. Same conventions as the
completed Admin port: JS + existing `ui.jsx` light theme, firm-scoped, audited,
verified live per phase.

## Role mapping
Prototype `branch_admin` → CRM **Sub-Admin**. A Sub-Admin runs ONE branch's daily
operations: approves front-line execs' requests, manages attendance/leave, monitors
the sales team, and holds inventory — the operational/approver layer beneath Admin.

## Scoping decisions (2026-07-13)
1. **Sub-Admin = branch operational approver.** Gains: leave approvals, booking/token
   verification, unit-hold, branch settings. 
2. **Discounts stay at Admin** (Phase 7, built) — not forked to Sub-Admin.
3. **Reuse existing:** unit-lock (Admin Phase 3), lead-assign, employee `withMetrics`,
   attendance review — Sub-Admin gets scoped RBAC to these, no duplicate code.
4. **Branch is single-scope** for a Sub-Admin: their `user.branch` (matched to a
   Branch doc). No branch switcher.

## Current Sub-Admin baseline (already exists)
Employees (CRUD execs), Lead Import, Assign Leads (round-robin), Customer monitoring,
Attendance review, Site-visit oversight, Reports. RBAC: user CRUD, lead
view/create/edit/assign/import, customer/visit/attendance view, report view/export.

## Net-new for Branch Admin
- **`LeaveRequest`** model + approval workflow (exec requests → sub-admin approves).
- **Branch settings** fields (geofence radius, working hours, auto-route) on `Branch`.
- **Action Center** — unified pending-approvals hub (frontend aggregation).
- **Sales Team Health** cards (frontend over existing metrics + attendance).
- RBAC additions for Sub-Admin: `booking:[view,edit]`, `unit:[view,edit]`,
  `branch:[view,edit]` (own branch), new `leave` module `[view,approve]`;
  Executive gets `leave:[view,create]`.

## Phases
### Phase B0 — Sub-Admin shell + nav  ✅ DONE (2026-07-13)
`NAV_BY_ROLE[sub_admin]` matches the prototype branch sidebar EXACTLY — 8 flat tabs
(verified against screenshot): Dashboard · Action Center · Sales Team Logs ·
Lead Management · Customer Timelines · Tower Matrix Grid · Attendance & Leaves ·
Reports & Settings — plus a **geofence footer card** (branch name + radius) rendered
in DashboardLayout. Labels kept generic (branch is per-user, not hardcoded "Pune").
Net-new consoles stubbed; existing pages (import/assign/visits/reports) stay mounted.

### Phase B1 — Leave Management  ✅ DONE (2026-07-13)
`LeaveRequest` model (employee, type, dates, days, reason, status). Exec creates;
Sub-Admin approves/rejects (notify + audit). New `leave` MODULE + RBAC. Leaves tab UI.

### Phase B2 — Branch operations RBAC + Inventory holds + Booking verification  ✅ DONE (2026-07-13)
Grant Sub-Admin `unit:[view,edit]` (hold/release, reuse Phase 3 lock) and
`booking:[view,edit]` (verify reserved→confirmed). Branch Inventory page (hold/release,
scoped to branch's projects). Booking verification list.

### Phase B3 — Sales Team Health  ✅ DONE (2026-07-13)
Roster + per-exec health card (attendance %, target, rating, lead-response, score)
built from existing `withMetrics` + attendance aggregations. Read-only monitoring.

### Phase B4 — Action Center  ✅ DONE (2026-07-13)
Unified approvals hub: pending leaves, reserved bookings awaiting verification, locked
units, unassigned-lead pool — each actionable inline. Live pending-count badge in nav.

### Phase B5 — Branch Settings  ✅ DONE (2026-07-13) — BRANCH FLOW COMPLETE
Add geofence radius, working hours, lead auto-routing to `Branch`; Sub-Admin edits
their own branch. Operational reports (CSV) + local audit view.

### Deferred (lower value; optional Phase B6)
Builder Circulars, Price-Update broadcast — HQ→branch push flows; port later if wanted.

## Cross-cutting
Audit every mutation; firm-scope + branch-scope every query; existing `ui.jsx`;
verify each phase live on a throwaway port (pkill stale servers first).
