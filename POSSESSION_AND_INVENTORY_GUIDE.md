# 🏢 Possession & Property Inventory Modules: Sub-Admin vs. Sales Executive

This guide breaks down the data models, architecture, permissions, and operational differences between **Sub-Admin (Branch Manager)** and **Sales Executive (Field/Sales Agent)** for both the **Possession Module** and the **Property Inventory Module**.

---

## 📑 Table of Contents
1. [Executive Summary Comparison](#1-executive-summary-comparison)
2. [Module 1: Possession Model (`PossessionCase.js`)](#2-module-1-possession-model-possessioncasejs)
   - [2.1 Data Model Architecture](#21-data-model-architecture)
   - [2.2 Handover Lifecycle & Checklist Engine](#22-handover-lifecycle--checklist-engine)
   - [2.3 Sub-Admin Role & Capabilities](#23-sub-admin-role--capabilities)
   - [2.4 Sales Executive Role & Capabilities](#24-sales-executive-role--capabilities)
   - [2.5 Side-by-Side Workflow Walkthrough](#25-side-by-side-workflow-walkthrough)
3. [Module 2: Property Inventory Model (`Unit.js`)](#3-module-2-property-inventory-model-unitjs)
   - [3.1 Data Model Architecture](#31-data-model-architecture)
   - [3.2 Unit Status Lifecycle & Locking Engine](#32-unit-status-lifecycle--locking-engine)
   - [3.3 Sub-Admin Role & Capabilities](#33-sub-admin-role--capabilities)
   - [3.4 Sales Executive Role & Capabilities](#34-sales-executive-role--capabilities)
   - [3.5 Unit Transfer & Double-Booking Protection](#35-unit-transfer--double-booking-protection)
4. [Master Feature Matrix](#4-master-feature-matrix)

---

## 1. Executive Summary Comparison

| Dimension | Sub-Admin (Branch Manager) | Sales Executive (Frontline Agent) |
|---|---|---|
| **Possession Data Scope** | **Branch-wide / Firm-wide**: Sees all customer handover cases across the branch. | **Own Scope Only**: Sees only cases assigned to them or created by them. |
| **Possession Authority** | Approves checklist milestones, schedules handovers, reassigns cases, exports reports. | Performs physical flat inspection, uploads handover documents, marks checklist tasks. |
| **Inventory Data Scope** | Full inventory across all builders and projects in the firm. | Full inventory view, but tuned for sales pitching, search, and client sharing. |
| **Inventory Actions** | **Administrative Control**: Lock units (with auto-expiry), release locks, transfer unit holdings, edit unit pricing/parking. | **Operational Sales**: Search real-time available stock, initiate instant booking (auto-lock), share unit cards via WhatsApp/Email. |

---

## 2. Module 1: Possession Model (`PossessionCase.js`)

### 2.1 Data Model Architecture

The `PossessionCase` model (`server/src/models/PossessionCase.js`) governs the post-registration property handover process:

```javascript
// Key Fields in PossessionCase Schema
{
  caseCode: String,                // Auto-generated: POS-YYYY-NNNN (e.g., POS-2026-0001)
  firm: ObjectId -> Firm,          // Multi-tenant isolation
  branch: String,                  // Branch identification
  customer: ObjectId -> Customer,  // Customer reference
  booking: ObjectId -> Booking,    // Related confirmed booking
  project: String,                 // Project name
  unitNumber: String,              // Flat/unit number
  assignedEmployee: ObjectId -> User, // Assigned Sales Executive
  
  scheduledDate: Date,             // Handover appointment date
  scheduledTime: String,           // Appointment time slot
  actualPossessionDate: Date,      // Final handover completion date
  
  status: String,                  // Possession status enum
  checklist: [                     // Pre-handover readiness checklist
    { item: String, status: 'Pending' | 'Completed', date: Date, user: String }
  ],
  documents: [                     // Key handover documents & snag sheets
    { name: String, status: 'Pending' | 'Received' | 'Verified' | 'Rejected', fileUrl: String }
  ],
  timeline: [...]                  // Full audit history of activities
}
```

---

### 2.2 Handover Lifecycle & Checklist Engine

A possession case advances through 9 standardized lifecycle stages:
```text
Pending ➔ Readiness Check ➔ Ready for Possession ➔ Scheduled ➔ Handover In Progress ➔ Handover Completed ➔ Customer Confirmation Pending ➔ Completed (or Cancelled)
```

The system automatically initializes every new case with the **8-Point Readiness Checklist**:
1. **Registration Completed** (Sub-registrar deed verified)
2. **Property Ready** (Construction & cleaning completed)
3. **Unit Inspection Completed** (Pre-delivery inspection with customer)
4. **Keys Available** (Master & duplicate keys ready at site office)
5. **Required Documents Ready** (NOC, Possession Letter, Allotment Certificate)
6. **Utility / Meter Details Ready** (Electricity, water, gas meter readings)
7. **Final Dues Check** (All installments and maintenance settled)
8. **Handover Documents Ready** (Signed receipt and indemnity)

---

### 2.3 Sub-Admin Role & Capabilities (`/sub-admin/possession`)

- **Scope:** Branch-level supervision. Sees all cases belonging to their branch.
- **Backend Query:**
  ```javascript
  // server/src/controllers/possession.controller.js
  if (req.user.role !== ROLES.SUPER_ADMIN) scope.firm = req.user.firm;
  // Sub-admin has firm/branch scope (sees all team cases)
  ```
- **Key Actions:**
  1. **Case Creation (`CreatePossessionCase.jsx`):** Creates new cases when a customer finishes registration.
  2. **Executive Assignment:** Assigns a field sales executive to handle the on-site walkthrough.
  3. **Milestone Verification:** Verifies submitted documents (`Received` ➔ `Verified`).
  4. **Schedule Handover Date:** Finalizes the appointment date and time for key handover.
  5. **Branch Dashboard & Reports:** Reviews handover bottlenecks, agent completion ratios, and exports CSV reports (`PossessionDashboard.jsx`, `PossessionReports.jsx`).

---

### 2.4 Sales Executive Role & Capabilities (`/executive/possession`)

- **Scope:** Restricted strictly to their own assigned buyers.
- **Backend Enforcement:**
  ```javascript
  // server/src/controllers/possession.controller.js
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    scope.$or = [{ assignedEmployee: req.user._id }, { createdBy: req.user._id }];
  }
  ```
- **Key Actions:**
  1. **Assigned Case Tracking:** Sees upcoming possession dates for their clients.
  2. **Conduct On-Site Snag Inspection:** Walks the buyer through the unit, checking fixtures, paint, and utilities.
  3. **Checklist Execution:** Marks checklist items (e.g., toggles *Unit Inspection Completed* and *Keys Available*).
  4. **Document Collection:** Collects buyer's signed possession acknowledgment slip and uploads it.
  5. **Status Updates:** Moves case from `Scheduled` to `Handover In Progress` and `Handover Completed`.

---

### 2.5 Side-by-Side Workflow Walkthrough

```text
[Sub-Admin] Creates case POS-2026-001 & Assigns to Executive Kavya
      │
      ▼
[Sales Executive (Kavya)] Coordinates with client & performs joint site inspection
      │
      ▼
[Sales Executive (Kavya)] Toggles "Unit Inspection Completed" on checklist & uploads photo
      │
      ▼
[Sub-Admin] Verifies final payment clearance & sets status to "Ready for Possession"
      │
      ▼
[Sales Executive & Sub-Admin] Hand over physical keys; client signs handover sheet ➔ Case Marked "Completed"
```

---

## 3. Module 2: Property Inventory Model (`Unit.js`)

### 3.1 Data Model Architecture

The `Unit` model (`server/src/models/Unit.js`) manages all physical real estate stock (flats, plots, villas, offices):

```javascript
// Key Fields in Unit Schema
{
  firm: ObjectId -> Firm,          // Multi-tenant firm boundary
  project: ObjectId -> Project,    // Parent project reference
  unitNumber: String,              // e.g., "A-102", "Villa 14"
  unitType: String,                // "2BHK", "3BHK", "Penthouse"
  configuration: String,           // 1BHK / 2BHK / Commercial / Plot
  propertyType: String,            // Apartment / Villa / Plot
  floor: String,                   // Floor number
  tower: String,                   // Tower or Wing name
  facing: String,                  // East, West, North, South
  areaSqft: Number,                // Carpet / Super-built area
  
  basePrice: Number,               // Standard unit rate
  currentPrice: Number,            // Effective price after builder revision
  discount: Number,                // Percentage discount allowed
  
  status: String,                  // available | hold | locked | reserved | booked | sold
  
  // Temporary Lock Engine
  lockedForCustomer: ObjectId -> Customer,
  lockedUntil: Date,               // Auto-expiry timestamp
  lockReason: String,
  lockedBy: ObjectId -> User,
  
  // Audit Trail of Unit Transfers
  transferHistory: [
    { at: Date, direction: 'in' | 'out', fromUnit: ObjectId, toUnit: ObjectId, reason: String, byName: String }
  ]
}
```

---

### 3.2 Unit Status Lifecycle & Locking Engine

```text
AVAILABLE ────► LOCKED (Temporary hold with auto-expiry)
    │                  │
    │ (Booking)        │ (Booking confirmed)
    ▼                  ▼
RESERVED  ────►  BOOKED  ────►  REGISTERED  ────►  POSSESSION  ────►  SOLD
```

- **Auto-Expiry Mechanism (`releaseExpiredLocks`):**
  When a unit is temporarily locked for a lead, the server checks `lockedUntil <= new Date()`. If expired, the unit automatically reverts to `AVAILABLE` without manual intervention.

---

### 3.3 Sub-Admin Role & Capabilities (`/sub-admin/inventory`)

- **Interface:** `pages/admin/InventoryPage.jsx` (mounted with `basePath="/sub-admin/inventory"`).
- **Key Actions:**
  1. **Lock Unit (`unitsApi.lock`):** Temporarily holds a unit for an interested client (e.g., 24-hour lock) while they arrange the token cheque.
  2. **Release Unit (`unitsApi.release`):** Manually unlocks a unit if the prospective customer decides not to proceed.
  3. **Unit Transfer (`POST /api/units/:id/transfer`):**
     - Moves a customer's holding from one unit to another (e.g., customer wants 5th floor instead of 2nd floor).
     - Both source and destination units retain permanent transfer history.
     - Auto-re-points active reservations to the new unit.
  4. **Manage Pricing & Details:** Edits unit details, area, parking allocations (covered/open), and discounts.

---

### 3.4 Sales Executive Role & Capabilities (`/executive/inventory`)

- **Interface:** `pages/executive/MyInventoryPage.jsx`.
- **Key Actions:**
  1. **Smart Inventory Search:**
     - High-speed filters by Builder, Project, BHK, Facing, Tower, Floor, and Budget.
     - Toggle between Table view and Grid view cards.
  2. **Instant Booking (`+ Create Booking` modal):**
     - Opens booking form directly from any `AVAILABLE` unit.
     - Selecting the unit triggers an immediate reservation block to prevent double-booking.
  3. **Schedule Site Visit (`Schedule Visit` modal):**
     - Selects customer, date, and time to link a site visit directly to that project and flat type.
  4. **Share Property Modal (WhatsApp & Email):**
     - Formats a property card (Project name, flat configuration, floor, carpet area, and price).
     - Allows instant sharing to client via WhatsApp (`wa.me/?text=...`) or Email with one click.
  5. **Restrictions:**
     - *Read-only on catalog*: Cannot change flat prices, cannot manually lock units, and cannot perform transfers.

---

### 3.5 Unit Transfer & Double-Booking Protection

#### How Double-Booking is Prevented:
1. **Compound Unique Index:** `unitSchema.index({ project: 1, unitNumber: 1 }, { unique: true })`.
2. **Atomic Status Check:** When creating a booking, the backend checks:
   ```javascript
   if (unit.status !== UNIT_STATUS.AVAILABLE) {
     throw ApiError.conflict('This unit is already reserved or booked by another agent.');
   }
   ```
3. If two executives hit "Submit Booking" at the same second, the first one acquires the status change to `RESERVED`, and the second one receives an immediate `409 Conflict` error.

---

## 4. Master Feature Matrix

| Action / Capability | Sub-Admin (Branch Manager) | Sales Executive (Frontline Agent) |
|---|:---:|:---:|
| **POSSESSION MODULE** | | |
| View All Branch Possession Cases | ✅ Yes | ❌ No (Own assigned cases only) |
| Create New Possession Case | ✅ Yes | ❌ No (Requires manager initiation) |
| Assign Possession Case to Agent | ✅ Yes | ❌ No |
| Toggle Inspection Checklist Items | ✅ Yes | ✅ Yes (On-site inspection) |
| Upload Signed Handover Documents | ✅ Yes | ✅ Yes |
| Final Milestone & Handover Approval| ✅ Yes | ❌ No (Manager sign-off) |
| Export Branch Possession Reports | ✅ Yes (CSV) | ❌ No |
| **PROPERTY INVENTORY MODULE** | | |
| Search Available Stock & Pricing | ✅ Yes | ✅ Yes |
| View Unit Specifications & Floor Plans| ✅ Yes | ✅ Yes |
| Temporary Lock / Hold Unit | ✅ Yes (with timer) | ❌ No |
| Release Locked Unit | ✅ Yes | ❌ No |
| Transfer Booking to Another Unit | ✅ Yes (Preserves Audit) | ❌ No |
| Edit Unit Details, Price, Parking | ✅ Yes | ❌ No |
| Direct Booking from Available Unit | ✅ Yes | ✅ Yes (Auto-Locks Unit) |
| Schedule Unit-Linked Site Visit | ✅ Yes | ✅ Yes |
| Share Unit Card via WhatsApp / Email | ✅ Yes | ✅ Yes (Quick Share Modal) |
