# Sales Executive Flow — Port & Implementation Plan

## Source
`SalesExecutivePortal.tsx` (3,751 lines) — a mobile-simulator prototype. Presentation-
heavy, faked logic (GPS bounds, selfie liveness, simulated approvals, offline queue).
Treat as a UX/feature reference, NOT a logic source.

## Reality check — the CRM Executive is already ~80% there
Existing (backend + basic UI): My Customers, Customer 360° (editable), Follow-ups
(create/complete/miss/reschedule), Site Visits (create/conduct/reschedule/cancel),
Bookings (with REAL double-booking block — stronger than prototype), GPS check-in/out
(real geolocation). Endpoints already built, no UI yet: **raise discount request**
(exec has `discount:create`), **raise leave request** (exec has `leave:create`).

## Entity mapping
Prototype separates "leads" and "customers"; the CRM **unifies** them as `Customer`
(leads = early-status customers). Prototype booking→customer auto-conversion is N/A
(the lead already IS the customer). Overlays map to: call/meeting → follow-up; site
visit → visit; negotiate → discount request; book → booking. Skip faked ones.

## Decisions (RESOLVED 2026-07-13)
1. **Frame → MOBILE PHONE FRAME.** Build a distinct phone-frame mobile shell for the
   Executive (device chrome, bottom nav, Quick-Add FAB) — separate from the desktop
   sidebar the other roles use. Still uses `ui.jsx` primitives + light theme inside.
2. **Scope → E0–E3.** Shell+Home+Profile, request actions, Builders+Pipeline,
   EOD report + EMI planner. E4 (selfie/gate) deferred.

## Skipped (faked in prototype / low value / heavy): selfie liveness, offline
sync queue, voice-memo transcription, WhatsApp templates, AI matchmaker,
gamification streaks. Flag if any are wanted.

## Phases
### E0 — Exec shell + Home + Profile  ✅ DONE (2026-07-13)
Restructure exec nav to the prototype IA (Home · My Customers · Builders · Pipeline ·
Profile; keep Follow-ups/Visits/Bookings/Check-in reachable). Rich **Home**: real KPIs
(my leads, follow-ups today, visits, booked this month) + Today's Planner (follow-ups
due today, complete inline) + quick actions. **Profile**: performance metrics + attendance log.

### E1 — Request actions (surface existing endpoints)  ✅ DONE
Exec UI to **raise a discount-override request** (MyBookingsPage → Request Discount
modal, `bookingsApi.requestDiscount`) and **raise a leave request** (MyLeavePage,
`leavesApi.create`). Endpoints already existed; both surfaced in the exec UI.

### E2 — Builders directory + Pipeline analytics  ✅ DONE (2026-08-26)
Builders directory (`pages/executive/BuildersDirectoryPage.jsx`) — searchable builder
cards (RERA cert/expiry, compliance, commission) with per-builder project drill-down
via `buildersApi`/`projectsApi`. Pipeline analytics (`pages/executive/PipelinePage.jsx`)
— KPI row (total/active/won/conversion) + lightweight CSS charts (status funnel, source
distribution) from the exec's own customers. No chart lib. Nav: Pipeline + Builders items.

### E3 — EOD Daily Report + EMI planner  ✅ DONE (2026-08-26)
**EOD report**: new `DailyReport` model + controller/routes (`/api/daily-reports`,
owner/firm-scoped, one per user/day). Counts pre-fill from the day's real activity
(follow-ups completed, visits checked-in, bookings, leads assigned); exec adjusts +
adds summary/challenges/tomorrow-plan. UI: `pages/executive/DailyReportPage.jsx` (+ nav
"Daily Report"). **EMI planner**: client-side calculator as an "EMI Planner" tab on
Customer 360° (`CustomerProfilePage`) that saves the estimate as a customer note.

### E4 (optional) — Selfie attendance + attendance gate
Selfie capture on check-in (stored image) + lock app until checked in. Workflow change,
medium lift, questionable value for a web CRM. Deferred unless requested.

## Cross-cutting
Existing `ui.jsx` + light theme; reuse existing exec endpoints; audit is already wired
server-side; verify each phase live.
