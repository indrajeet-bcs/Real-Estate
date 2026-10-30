# 🔑 Account Credentials — Real Estate CRM

Single source of truth for every role's login. Roles (highest → lowest authority):
**Super Admin → Admin → Sub-Admin → Sales Executive.**

- **API:** http://localhost:5001  ·  **App:** http://localhost:5173
- Login page: `/login`
- Passwords are hashed in MongoDB via the `User` pre-save hook — the plain values below are the seed inputs.
- ⚠️ A user can only log in when **their account is active _and_ their firm is active/trial** (not suspended or soft-deleted).

---

## 1. Super Admins (platform level — no firm)

| Name | Email | Password | Status | Source |
|------|-------|----------|--------|--------|
| Platform Owner | `superadmin@crm.local` | `Password@123` | ✅ **active — verified working** | Live DB |

> ✅ **Every single account in the database uses the exact same password: `Password@123`.**

---

## 2. Demo firm hierarchy — shared password `Password@123`

Created by **`npm run seed:users`** (idempotent, wipes nothing) or `npm run seed:demo` (wipes all CRM data first).
Email pattern: `<role>@<firm-slug>.com`.

> ✅ **These three firms are ACTIVE and all 21 accounts log in** (verified 2026-09-15 across all roles).
> Reactivated via `server/reactivateDemoFirms.mjs`; new-module demo data (roles, master-data, loans/registration/possession) backfilled.
> Recommended logins for testing each role:
> - Admin: `admin@skylinerealty.com` / `Password@123`
> - Sub-Admin: `subadmin1@skylinerealty.com` / `Password@123`
> - Sales Executive: `exec1@skylinerealty.com` / `Password@123`

### Skyline Realty  (`skylinerealty.com`)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@skylinerealty.com` | `Password@123` |
| Sub-Admin | `subadmin1@skylinerealty.com` | `Password@123` |
| Sub-Admin | `subadmin2@skylinerealty.com` | `Password@123` |
| Sales Executive | `exec1@skylinerealty.com` | `Password@123` |
| Sales Executive | `exec2@skylinerealty.com` | `Password@123` |
| Sales Executive | `exec3@skylinerealty.com` | `Password@123` |
| Sales Executive | `exec4@skylinerealty.com` | `Password@123` |

### Metro Homes  (`metrohomes.com`)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@metrohomes.com` | `Password@123` |
| Sub-Admin | `subadmin1@metrohomes.com` | `Password@123` |
| Sub-Admin | `subadmin2@metrohomes.com` | `Password@123` |
| Sales Executive | `exec1@metrohomes.com` | `Password@123` |
| Sales Executive | `exec2@metrohomes.com` | `Password@123` |
| Sales Executive | `exec3@metrohomes.com` | `Password@123` |
| Sales Executive | `exec4@metrohomes.com` | `Password@123` |

### Coastal Estates  (`coastalestates.com`)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@coastalestates.com` | `Password@123` |
| Sub-Admin | `subadmin1@coastalestates.com` | `Password@123` |
| Sub-Admin | `subadmin2@coastalestates.com` | `Password@123` |
| Sales Executive | `exec1@coastalestates.com` | `Password@123` |
| Sales Executive | `exec2@coastalestates.com` | `Password@123` |
| Sales Executive | `exec3@coastalestates.com` | `Password@123` |
| Sales Executive | `exec4@coastalestates.com` | `Password@123` |

---

## 3. Live "BCS" firm accounts (created via the app — ✅ active)

These exist in the live DB and are active, but were created through the UI, so their
passwords are **user-set / not seeded**. Reset any of them with `server/resetUserPassword.js`
(edit the target email, then `node resetUserPassword.js` → sets `Password@123`).

| Role | Email | Branch | Password |
|------|-------|--------|----------|
| Admin | `suryakant@mail.com` | — | _user-set_ |
| Sub-Admin | `pranav@mail.com` | — | _user-set_ |
| Sub-Admin | `abhishek.deshmukh@company.com` | Kharadi Branch | _user-set_ |
| Sub-Admin | `rahul.patil@company.com` | Baner Branch | _user-set_ |
| Sub-Admin | `sneha.kulkarni@company.com` | Wakad Branch | _user-set_ |
| Sales Executive | `omkar@mail.com` | Pimpri | _user-set_ |
| Sales Executive | `onkar@mail.com` | Pimpri | _user-set_ |
| Sales Executive | `prathamesh@mail.com` | Pimpri | _user-set_ |

---

## Quick reference — seed commands (run from `server/`)

| Command | What it does |
|---------|--------------|
| `npm run seed` | Creates only the Super Admin from `.env` (`superadmin@crm.local`) |
| `npm run seed:users` | Recreates the 3 demo firms + full hierarchy, all `Password@123`. Wipes nothing. |
| `npm run seed:demo` | Full demo dataset across every module. **Wipes existing CRM data first.** |
| `node resetUserPassword.js` | Resets one hard-coded email's password to `Password@123` |
| `node checkUsers.js` | Verifies a user's password match |

---

_Last synced with live DB: 2026-08-26. Regenerate this file whenever accounts change._
