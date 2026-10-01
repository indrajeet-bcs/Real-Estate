# Company Management (Super Admin) - Implementation Plan

## Goal Description
Revamp the Super Admin Company Management module (`FirmsPage.jsx`) to align with an enterprise SaaS dashboard. The new implementation will introduce KPI cards, global search, advanced filters, detailed table columns (including storage usage and user count vs allowed), bulk actions, and explicit status workflows (Suspend, Soft Delete). All modifications will be strictly scoped to this module without altering the underlying design system or other areas of the CRM.

## Open Questions
- **Storage Usage Data:** Since no actual file storage is currently tracked in the database, I will mock the `storageUsed` values (or set them to 0) while enforcing the `storageLimit` from the subscription plan. Is this acceptable?
- **Total Revenue KPI:** I will calculate this dynamically by summing up a presumed MRR based on active subscription plans, or use a mocked MRR calculation per firm. 

## Proposed Changes

### Backend Updates

#### [MODIFY] `server/src/models/Firm.js`
- Introduce new fields for SaaS management:
  - `status`: `enum ['active', 'trial', 'suspended', 'deleted']` (Default: `'trial'`)
  - `subscriptionStatus`: `enum ['active', 'trial', 'expired', 'cancelled']` (Default: `'trial'`)
  - `billingCycle`: `enum ['monthly', 'yearly']` (Default: `'monthly'`)
  - `storageUsed`: `Number` (Default: `0`)
  - `storageLimit`: `Number` (Default: `10`)
  - `allowedUsers`: `Number` (Default: `25`)
  - `isDeleted`: `Boolean` (Default: `false`)
- Keep `isActive` synchronized with `status` (false if suspended/deleted) to maintain backward compatibility with auth middleware.

#### [MODIFY] `server/src/validators/firm.validators.js`
- Update `listFirmsSchema` to accept advanced filters (`plan`, `companyStatus`, `subscriptionStatus`, `billingCycle`).
- Add a new `bulkFirmActionSchema` to validate bulk operations.

#### [MODIFY] `server/src/controllers/firm.controller.js`
- **`listFirms`**: 
  - Exclude `{ isDeleted: true }` by default.
  - Calculate platform-wide KPIs (Total, Active, Trial, Suspended, Expired, Revenue) using MongoDB aggregations and attach them to the response `meta`.
  - Calculate current active users per firm and return alongside `allowedUsers`.
- **`setFirmStatus`**:
  - Extend to handle Suspend logic with a reason, synchronizing `subscriptionStatus` and cascading `isActive: false` to users.
- **[NEW] `bulkActions`**:
  - Implement bulk Suspend, Activate, Export, and Assign Subscription operations.
- **[NEW] `softDeleteFirm`**:
  - Implement soft deletion (`isDeleted = true`, `isActive = false`, cascade to users).

#### [MODIFY] `server/src/routes/firm.routes.js`
- Add `POST /bulk` mapped to the bulk actions controller.
- Add `DELETE /:id` mapped to the soft delete controller.

### Frontend Updates

#### [MODIFY] `my-app/src/api/resources.js`
- Expand `firmsApi` to include `.bulk(data)` and `.remove(id)` endpoints.

#### [MODIFY] `my-app/src/pages/superadmin/FirmsPage.jsx`
- Replace the current basic list with the comprehensive SaaS dashboard view.
- **Page Header**: Updated title, subtitle, and primary CTA.
- **KPI Cards**: Render the 6 required metric cards dynamically fed from the backend.
- **Search & Filters Row**: Incorporate global search and dropdown filters (Plan, Status, Billing, Date).
- **Data Table**:
  - Include custom columns: Logo, Name, ID, Admin details, Plan, Subs Status, Firm Status.
  - Add Storage Progress Bar and User Count indicators.
  - Add Row Selection checkboxes for bulk actions.
  - Include an "Actions" dropdown/menu for View, Edit, Suspend, Activate, Soft Delete.
- **Bulk Actions Toolbar**: Render contextually when rows are selected.
- **Modals**: Build confirmation dialogs for Suspend (with Reason input) and Soft Delete.
- **Empty State**: Visual empty state when no companies match filters.

## Verification Plan
### Automated Tests
- N/A (assuming no automated test suite is currently tracking these specific API structures).

### Manual Verification
1. Log in as Super Admin.
2. Navigate to `Firms / Admins` on the sidebar.
3. Verify the KPI cards render and display correct aggregations.
4. Test filtering by Plan, Status, and Search keywords.
5. Suspend a firm -> Verify confirmation modal, check if firm status updates, and verify its users can no longer log in.
6. Soft delete a firm -> Verify it disappears from the default list.
7. Test Bulk Actions (select multiple -> suspend).
8. Verify Storage Progress Bar and User limits render properly.
