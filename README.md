# Real Estate CRM (MERN)

Multi-tenant Real Estate CRM built from the *Final Userflow Real Estate* spec.
Four roles — **Super Admin**, **Admin**, **Sub-Admin**, **Sales Executive** — with
firm-scoped, permission-gated access.

## Stack
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + React Router + Axios (`my-app/`)
- **Backend:** Node.js + Express + MongoDB (Mongoose), JWT auth (`server/`)

## Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) **or** a MongoDB Atlas URI

## Backend — `server/`
```bash
cd server
cp .env.example .env      # then edit secrets / MONGO_URI
npm install
npm run seed              # creates just the initial Super Admin
npm run seed:demo         # OR: full demo dataset across every level (wipes existing data)
npm run dev               # http://localhost:5000
```
Default Super Admin from `npm run seed` (change in `.env`):
- email: `superadmin@crm.local`
- password: `SuperAdmin@123`

### Demo dataset (`npm run seed:demo`)
Populates the whole hierarchy so dashboards/reports have data. **Wipes existing CRM data.**
Every account uses password **`Password@123`**:
- 1 Super Admin — `superadmin@crm.local`
- 3 firms (Skyline Realty, Metro Homes, Coastal Estates), each with:
  - 1 Admin — `admin@<firm>.com` (e.g. `admin@skylinerealty.com`)
  - 2 Sub-Admins — `subadmin1@<firm>.com`, `subadmin2@<firm>.com`
  - 4 Executives — `exec1@<firm>.com` … `exec4@<firm>.com`
  - 2 builders, 3 projects, ~20 units, 12 customers (varied statuses), follow-ups, bookings, attendance

### API endpoints (all roles, spec-complete)
- **Auth** — `POST /api/auth/login` · `/refresh` · `/logout` · `/forgot-password` · `/reset-password` · `/change-password` · `GET /me`
- **Firms** (Super Admin) — `GET/POST/PATCH /api/firms` (+ `/:id/status`) — onboard/edit/deactivate firms + admins
- **Users** (Admin→Sub-Admin, Sub-Admin→Executive) — `GET/POST/PATCH /api/users` (+ `/:id/deactivate` with reassign-before-disable, `/activate`)
- **Builders** — `GET/POST/PATCH/DELETE /api/builders` (archive-not-delete)
- **Projects** — `GET/POST/PATCH/DELETE /api/projects` (archive keeps read-only reference)
- **Units** — `GET/POST/PATCH /api/units` (+ `/bulk`)
- **Customers / Leads 360°** — `GET/POST/PATCH /api/customers`, `/:id/notes`, `/interests`, `/documents`, `/status`, `/reopen`, plus `POST /assign` (round-robin) & `POST /import` (validation engine)
- **Follow-ups** — `GET/POST /api/followups`, `/:id/complete` · `/miss` (escalates) · `/reschedule`
- **Site Visits** — `GET/POST /api/visits`, `/:id/conduct` · `/reschedule` · `/cancel` · `/flag-missed`
- **Bookings** — `GET/POST /api/bookings` (double-booking hard block), `/:id/status`, `/milestones/:id`
- **Attendance** — `POST /api/attendance/check-in` · `/check-out`, `GET /me` · `/` (team review)
- **Notifications** — `GET /api/notifications`, `/:id/read`, `/read-all`
- **Audit logs** — `GET /api/audit-logs` (Super Admin: all; Admin: own firm)
- **Reports** — `GET /api/reports/summary` · `/lead-source` · `/booking-trend` · `/employee-performance` · `/visit-conversion` · `/attendance` · `/revenue`
- **Settings** (Super Admin) — `GET/PATCH /api/settings`, `GET /settings/permissions`
- `GET /api/health`

> The complete API was smoke-tested end-to-end (28 checks) across all four roles, including the
> double-booking block, import dedup/validation buckets, role-rank enforcement, and audit trail.

## Frontend — `my-app/`
```bash
cd my-app
npm install
npm run dev               # http://localhost:5173 (proxies /api to :5000)
```

### UI screens (all roles, spec-complete)
- **Auth** — login, forgot-password (OTP), silent token refresh
- **Dashboards** — live KPIs from `/reports/summary`, notification bell
- **Super Admin** — Firm onboarding (firm + admin in one modal), builders/projects (view-only), audit-log viewer with filters, permission matrix, system settings
- **Admin** — sub-admin management, builders, projects + inline inventory/units, all-clients history, reports, revenue
- **Sub-Admin** — employee management with **reassign-before-disable** modal, **4-step CSV lead-import wizard** (upload → column-map → validate → results buckets), individual/round-robin **assignment**, customer monitoring, attendance review, visit oversight
- **Sales Executive** — My Customers, **Customer 360°** (overview, notes, interested projects, documents, follow-ups, visits, bookings, activity timeline), follow-up management, site visits, **booking flow** (available-unit picker + double-booking block surfaced), GPS attendance check-in/out

Dark-themed (Tailwind v4). Frontend builds and lints clean; API contracts verified against the backend smoke test.

## Architecture notes
- **Multi-tenancy:** every firm-scoped query spreads `firmScope(user)` so tenants are isolated.
- **RBAC:** `server/src/config/permissions.js` holds the role→module→action matrix (spec §14),
  enforced by `requirePermission` / `requireRole` and mirrored to the UI via `useAuth().can()`.
- **Audit log:** every critical action + unauthorized attempt is written (spec §10).
- **Auth:** short-lived access token (memory) + rotating refresh token (httpOnly cookie).

## Build roadmap (next phases)
The foundation (auth, RBAC, tenancy, audit, all data models, Firm module) is in place.
Remaining modules follow the same controller/route/validator pattern:
Users · Builders · Projects · Units · Leads (+ CSV import) · Customer 360° ·
Follow-ups · Site Visits · Bookings (double-booking block) · Attendance ·
Reports · Notifications · Audit Log viewer · Settings.
