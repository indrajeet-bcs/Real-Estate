# Admin (Company Owner) Flow — Port & Implementation Plan

## Source
Porting the **Company Owner portal** from the `rera-saas-admin-portal` prototype
(`~/Desktop/rera-saas-admin-portal`, a TS + localStorage AI-Studio mockup) into the
real CRM's **Admin** role. Decisions locked: **full port, phased** · **match existing
CRM design** (keep dark-themed Tailwind + `ui.jsx`; adopt the prototype's structure
and flow, not its lucide/theme styling).

## Terminology mapping (prototype → CRM)
| Prototype | CRM equivalent |
|---|---|
| Company Owner | **Admin** (`role: admin`, firm-scoped) |
| Company / Tenant | **Firm** |
| Branch Admin | **Sub-Admin** |
| Sales Executive | **Sales Executive** |
| Buyer (KYC) | **Customer** |

## What already exists vs. net-new
**Reuse (models exist):** User, Builder, Project, Unit, Customer, Booking, Attendance,
FollowUp, AuditLog, SystemSetting. Assign/round-robin, double-booking block, and
reassign-before-deactivate are already implemented.

**Net-new entities:** `Branch`, `CommissionRule`, `DiscountRequest`.
**Net-new fields:** RERA numbers (Builder/Project), unit-lock metadata (Unit), KYC +
ownership-tag (Customer), discount/escrow/commission (Booking), branch targets.

## The big RBAC shift (must confirm)
Today Admin is **view-only** on leads/customers/follow-ups/visits/bookings/attendance.
This flow makes Admin an **active operator**: create bookings, run lead distribution,
transfer customer ownership, approve discounts, lock inventory, manage branches.
Every phase below therefore edits `server/src/config/permissions.js` (`ROLE_PERMISSIONS[admin]`)
and the matching route guards, and adds nav items in `my-app/src/lib/navConfig.js`
+ routes in `my-app/src/App.jsx`. Nav is role-fixed (not `can()`-filtered), so all
three layers (nav / route / permission) change together each phase.

---

## Decisions (RESOLVED 2026-07-10)
1. **RERA scope → KEEP FULLY.** Product becomes RERA-flavored: RERA cert/registration
   numbers on Builder/Project, KYC + Form-6 on Customer, escrow tokens on Booking, and
   the 3-gate discount guard (builder cert · buyer KYC · 10% escrow).
2. **Branch → INTRODUCE FIRST-CLASS COLLECTION.** New `Branch` model; migrate existing
   `User.branch` strings + `Firm.branches[]` into Branch docs. Sub-Admin ≈ Branch Admin.
3. **Admin-as-operator → YES.** Admin gains create/approve powers over
   leads/bookings/discounts/inventory (full RBAC expansion per phase).
4. **Commission split / discount cap / lock period → FIRM-LEVEL CONFIGURABLE** settings
   (not hardcoded), editable from Office Settings.

---

## Phased plan

### Phase 0 — Scaffolding & Admin shell  ✅ DONE (2026-07-10)
- Restructure `NAV_BY_ROLE[admin]` into the prototype's grouped nav (Consoles /
  Inventory & KYC / Overrides & Finance) using existing `type:'group'` support.
- Add all `/admin/*` routes in `App.jsx` (stub pages first) so navigation is live.
- Add new MODULES (`branch`, `commission`, `discount`) to `config/constants.js` and
  seed empty admin permissions to be filled per phase.
- Add an Admin profile route/page (prototype "Profile" tab).
- **Ship:** new Admin sidebar + reachable (stubbed) pages, no behavior change yet.

### Phase 1 — Regional Branches  ✅ DONE (2026-07-10)
- **Model** `Branch` { firm, name, adminUser, monthlyTarget, status } + derived
  metrics (activeUsers, salesCount, revenue, attendanceRate) computed via aggregation.
- Migrate Firm.branches / User.branch → Branch docs (seed script).
- **Backend** branch.controller + routes (list/create/update/setStatus), firm-scoped;
  RBAC `branch: [view,create,edit]`.
- **Frontend** `BranchesPage` — branch cards with target progress bars (matches
  prototype, built from `ui.jsx`).
- **Ship:** Admin manages branches; dashboard branch KPIs.

### Phase 2 — Employees & HR  ✅ DONE (2026-07-10)
- Extend user list with branch filter; **Transfer wizard** (3-step modal: destination
  branch → lead-handling `retain`/`reassign` → authorization note) → new
  `PATCH /users/:id/transfer` (moves branch, optionally reassigns leads, audited).
- **Attendance Register** sub-tab reading existing Attendance (GPS coords, punch in/out).
- **Ship:** Employees page with transfer + attendance register.

### Phase 3 — Property Inventory + RERA + Unit locking  ✅ DONE (2026-07-10)
- **Fields:** Builder.reraCert, Project.reraNumber + commissionRate, Unit lock metadata
  (`lockedForCustomer`, `lockedUntil`, `lockReason`; reuse existing `status` enum,
  add `locked` handling).
- **Backend** unit lock/release endpoints (`POST /units/:id/lock`, `/release`) with
  48h auto-expiry logic; builder/project create modals capture RERA fields.
- **Frontend** Inventory page: unit grid w/ filters + lock/release, Builders & Projects
  directory, onboard-builder / register-project modals.
- **Ship:** full inventory management with temporary unit holds.

### Phase 4 — Leads & Buyers  ✅ DONE (2026-07-10)
- **Distribution engine:** extend assign endpoint with `round_robin | performance |
  load_balanced` algorithms (round-robin exists).
- **Customer fields:** kycStatus, reraDocSigned (Form-6), ownership tag; ownership
  transfer endpoint (reassign a single customer to an exec).
- **Frontend** Leads Pipeline + Buyers(KYC) tabs, allocator modal, new-lead modal,
  ownership-transfer modal.
- RBAC: Admin gains `lead:[view,create,assign]`, `customer:[view,edit]`.
- **Ship:** Admin runs lead allocation + manages buyer KYC.

### Phase 5 — Booking Registers  ✅ DONE (2026-07-10)
- **Booking fields:** appliedDiscount, escrowToken(amountReceived), commissionEarned,
  status incl. `RERA Verified`. Available-only unit picker (double-booking guard exists).
- **Backend** admin booking create/list; commission computed from project rate.
- RBAC: Admin gains `booking:[view,create,edit]`.
- **Ship:** Admin registers property sales with discount + commission calc.

### Phase 6 — Commission Rules engine  ✅ DONE (2026-07-10)
- **Model** `CommissionRule` { firm, name, builder?, baseRate, targetThreshold,
  acceleratorRate, active }. CRUD + the brokerage sandbox calculator (client-side).
- Firm setting for 60/25/15 split.
- RBAC: `commission:[view,create,edit]`.
- **Ship:** configurable commission matrices + sandbox.

### Phase 7 — Discount Override approvals  ✅ DONE (2026-07-10)
- **Model** `DiscountRequest` { firm, lead/customer, unit, requestedDiscount,
  standardCap, executive, reason, status }. Created by executives, approved/rejected
  by Admin behind the **3-gate guard** (builder RERA cert · buyer KYC · 10% escrow).
- Notification to Admin on new request; audit on decision.
- RBAC: `discount:[view,approve]`.
- **Ship:** end-to-end discount override workflow.

### Phase 8 — Reports Vault · Office Settings · Profile  ✅ DONE (2026-07-10) — FLOW COMPLETE
- Reports: branch-wise sales, commission-accrual ledger, RERA inventory audit (real
  export where feasible, not just alert()).
- Office Settings: firm-level discount cap + lock period + integrations placeholders.
- Profile: Admin profile + RERA scope/privileges panel.
- **Ship:** feature-complete Admin flow.

---

## Cross-cutting
- **Audit:** every new mutation calls `writeAudit(...)` (prototype logs everything).
- **Tenancy:** every new query spreads `firmScope(user)`.
- **Design:** all pages use existing `ui.jsx` (PageHeader/Table/Modal/StatCards) +
  current dark theme — no lucide-react, no second theme system.
- **Verify:** boot server on :5001, seed, exercise each phase via API + UI before ship.

## Verification per phase
Manual: log in as `admin@skylinerealty.com` (Password@123), exercise the phase's
screens; confirm firm-scoping (Skyline admin can't see Metro data) and audit entries.
