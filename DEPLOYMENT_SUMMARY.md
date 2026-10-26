# 🚀 Real Estate CRM — Deployment Issue Summary

**Project:** Real Estate CRM (MERN Stack)
**Frontend:** Vercel → `https://real-estate-gamma-flame-64.vercel.app`
**Backend:** Render → `https://real-estate-backend-kz7v.onrender.com`
**Database:** MongoDB Atlas → `real-estate.g2gde4t.mongodb.net`
**Session Date:** 2026-10-26

---

## 📋 Overview

Three distinct but chained problems surfaced after deploying to production.
All three share the same root theme: **code written for local development
was deployed to production without adjusting for cross-origin, cross-site realities.**

---

## Issue 1 — Login returned `200 OK` with an Empty Body

### 🔴 Symptom
- Network tab: `POST /api/auth/login` → **`200 OK`**, **`Content-Length: 0`**
- UI showed: **"Login failed. Please try again."**
- Browser console: **no error printed at all**

### 🔍 Why This Happened

`my-app/src/api/client.js` had a hardcoded relative base URL:

```javascript
const api = axios.create({ baseURL: '/api' })
```

**Locally:** Vite's dev-server proxy transparently rewrites `/api/*` → `http://localhost:5001/*`.
Everything works fine.

**On Vercel:** `/api` is relative, so the browser resolves it to the Vercel
static site's own domain:

```
POST https://real-estate-gamma-flame-64.vercel.app/api/auth/login
```

Vercel's CDN edge server received the POST request, matched it via the SPA
rewrite rule `/(.*) → index.html`, and responded with:

```
HTTP/1.1 200 OK
Content-Length: 0
```

**The request never reached the Express backend at all.**

Even though `VITE_API_URL=https://real-estate-backend-kz7v.onrender.com` existed
in `my-app/.env`, the variable was never read by `client.js` — it was just
unused configuration.

#### Why the Error Was Silent in Console

Axios received an empty `200 OK` body → `response.data = ""`.
The login function immediately executed:

```javascript
setAccessToken(data.data.accessToken)
// TypeError: Cannot read properties of undefined (reading 'accessToken')
```

This is a JavaScript runtime `TypeError` — **not** an Axios HTTP error.
The catch block checked `err.response?.data?.message` which only exists on
Axios HTTP errors. A `TypeError` has no `.response`, so it silently fell
back to the generic string. `console.error(err)` was missing entirely.

### ✅ Fix

**`my-app/src/api/client.js`** — Read env var at runtime:
```javascript
const rawUrl = (import.meta.env.VITE_API_URL || '/api').trim()
const baseURL = (rawUrl.startsWith('http') && !rawUrl.endsWith('/api'))
  ? `${rawUrl}/api` : rawUrl
const api = axios.create({ baseURL, withCredentials: true })
```

**`my-app/src/context/AuthContext.jsx`** — Defensive payload check:
```javascript
const payload = res?.data?.data
if (!payload?.accessToken || !payload?.user) {
  throw new Error('Invalid response structure received from server')
}
```

**`my-app/src/pages/auth/LoginPage.jsx`** — Log the real error:
```javascript
} catch (err) {
  console.error('[Login Error]', err)
  setError(err.response?.data?.message || err.message || 'Login failed. Please try again.')
}
```

---

## Issue 2 — CORS Policy Blocked Frontend → Backend

### 🔴 Symptom
```
Access to XMLHttpRequest at 'https://real-estate-backend-kz7v.onrender.com/api/auth/login'
from origin 'https://real-estate-gamma-flame-64.vercel.app' has been blocked by CORS policy:
The 'Access-Control-Allow-Origin' header has a value 'http://localhost:5173'
that is not equal to the supplied origin.
```

### 🔍 Why This Happened

`server/src/app.js` configured CORS as:

```javascript
app.use(cors({ origin: env.clientUrl, credentials: true }))
```

`env.clientUrl` reads `process.env.CLIENT_URL`. On Render, `CLIENT_URL` was
**not set as an environment variable**. The fallback in `env.js` was:

```javascript
clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
```

So every response from the backend included:
```
Access-Control-Allow-Origin: http://localhost:5173
```

Browsers enforce CORS strictly: the `Access-Control-Allow-Origin` header must
**exactly match** the requesting origin. Since the Vercel domain didn't match
`localhost`, the browser blocked every preflight OPTIONS request and all
subsequent API calls.

#### Secondary Problem — SameSite Cookie Rejection

The refresh token cookie was set as:
```javascript
sameSite: isProd ? 'strict' : 'lax'
```
`SameSite=Strict` cookies are **silently dropped** by browsers on cross-site
requests. Vercel and Render are different domains → different sites. Even after
fixing CORS, the refresh/stay-logged-in flow would have silently broken.

### ✅ Fix

**`server/src/app.js`** — Multi-origin allowlist + `*.vercel.app` wildcard:
```javascript
app.set('trust proxy', 1)

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://real-estate-gamma-flame-64.vercel.app',
  'https://real-estate-frontend-5hm9.onrender.com',
  env.clientUrl,
].filter(Boolean))

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true)
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return callback(null, true)
    callback(new Error(`CORS: origin '${origin}' not allowed`))
  },
  credentials: true,
}))
```

**`server/src/controllers/auth.controller.js`** — Fix cookie for cross-site:
```javascript
sameSite: isProd ? 'none' : 'lax',  // 'none' is required cross-domain over HTTPS
```

**`my-app/vercel.json`** — SPA fallback so React Router works on refresh:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## Issue 3 — Login Returned `401 Unauthorized` for All Credentials

### 🔴 Symptom
```
POST /api/auth/login  →  401 Unauthorized — "Invalid email or password"
```
`admin@coastalestates.com / Password@123` worked locally but failed on Render.

### 🔍 Why This Happened

The production MongoDB Atlas cluster (`real-estate.g2gde4t.mongodb.net`) was
**completely empty — zero users in the database**.

Local development had data because seed scripts had been run at some point
against a local or separate MongoDB instance. The production Atlas cluster was
a fresh cluster that was never seeded.

The seed scripts (`npm run seed:users`, `npm run seed:demo`) are standalone
scripts that require a manual `node src/utils/seedUsers.js` invocation.
No seed step was included in the Render deployment process, so the production
database remained empty after every deploy.

The error message `"Invalid email or password"` was misleading — it looked like
a wrong password problem, but actually meant **"this user account does not exist."**

### ✅ Fix

**Step 1 — Immediate recovery:** Ran `npm run seed:users` locally, which
connected to the production Atlas URI from `.env` and created all 22 accounts
directly in the live database.

```
[seed:users] Seeding accounts from CREDENTIALS.md (no data is wiped)
+ created super_admin     superadmin@crm.local
+ created admin           admin@coastalestates.com
...
[seed:users] Done. Users collection now has 22 accounts.
```

**Step 2 — Permanent prevention:** Created `server/src/utils/startupSeed.js`,
an idempotent seed that runs on every server boot:

```javascript
export async function runStartupSeed() {
  // Safe to re-run: skips any existing user/firm, never deletes anything
  await ensureUser({ email: 'superadmin@crm.local', role: 'super_admin', ... })
  for (const firm of FIRMS) {
    await ensureFirm(firm)
    await ensureUser({ email: `admin@${domain}`, role: 'admin', ... })
    // subadmin1, subadmin2, exec1–exec4
  }
}
```

**Step 3 — Wired into `server/src/server.js`:**
```javascript
await connectDB()
await runStartupSeed()   // runs on every boot — idempotent & safe
app.listen(env.port, ...)
```

---

## 📊 All Issues at a Glance

| # | Symptom | Root Cause | File | Fix |
|---|---|---|---|---|
| 1 | `200 OK` + empty body, silent fail | `baseURL: '/api'` (relative) resolved to Vercel CDN, not Render backend | `client.js` | Read `VITE_API_URL`; defensive payload check |
| 2 | CORS blocked preflight | `cors({ origin: env.clientUrl })` fell back to `localhost` on Render | `app.js` | Multi-origin Set allowlist + `*.vercel.app` regex |
| 2b | Refresh cookie silently dropped | `SameSite=Strict` rejected on cross-site requests | `auth.controller.js` | `SameSite=None` in production |
| 3 | `401 Unauthorized` for all users | Production MongoDB was empty — no users seeded | `server.js` | Seeded live DB + `startupSeed.js` auto-runs on boot |

---

## 🗂️ Files Changed

| File | What Changed |
|---|---|
| [`server/src/app.js`](file:///d:/My%20Projects/Real%20Estate/server/src/app.js) | Multi-origin CORS allowlist + `trust proxy` |
| [`server/src/controllers/auth.controller.js`](file:///d:/My%20Projects/Real%20Estate/server/src/controllers/auth.controller.js) | `sameSite: 'none'` in production |
| [`server/src/server.js`](file:///d:/My%20Projects/Real%20Estate/server/src/server.js) | Call `runStartupSeed()` on every boot |
| [`server/src/utils/startupSeed.js`](file:///d:/My%20Projects/Real%20Estate/server/src/utils/startupSeed.js) | **New** — idempotent startup seed module |
| [`my-app/src/api/client.js`](file:///d:/My%20Projects/Real%20Estate/my-app/src/api/client.js) | Dynamic `baseURL` from `VITE_API_URL` |
| [`my-app/src/context/AuthContext.jsx`](file:///d:/My%20Projects/Real%20Estate/my-app/src/context/AuthContext.jsx) | Defensive `payload` check before reading properties |
| [`my-app/src/pages/auth/LoginPage.jsx`](file:///d:/My%20Projects/Real%20Estate/my-app/src/pages/auth/LoginPage.jsx) | `console.error` + `err.message` fallback |
| [`my-app/vercel.json`](file:///d:/My%20Projects/Real%20Estate/my-app/vercel.json) | SPA rewrite rule for React Router |

---

## 🔑 Production Credentials

All demo accounts use password **`Password@123`**

| Role | Email |
|---|---|
| Super Admin | `superadmin@crm.local` |
| Admin | `admin@skylinerealty.com` |
| Admin | `admin@metrohomes.com` |
| Admin | `admin@coastalestates.com` |
| Sub-Admin | `subadmin1@skylinerealty.com` |
| Sub-Admin | `subadmin2@skylinerealty.com` |
| Sub-Admin | `subadmin1@metrohomes.com` |
| Sub-Admin | `subadmin2@metrohomes.com` |
| Sub-Admin | `subadmin1@coastalestates.com` |
| Sub-Admin | `subadmin2@coastalestates.com` |
| Sales Executive | `exec1@skylinerealty.com` · `exec2` · `exec3` · `exec4` |
| Sales Executive | `exec1@metrohomes.com` · `exec2` · `exec3` · `exec4` |
| Sales Executive | `exec1@coastalestates.com` · `exec2` · `exec3` · `exec4` |

---

## 💡 Key Lessons Learned

1. **Relative API URLs (`/api`) only work behind a proxy.**
   Vite's dev proxy makes `/api` work locally. On a deployed static host,
   `/api` resolves to the static site itself. Always use `import.meta.env.VITE_API_URL`
   for the deployed base URL.

2. **A single `origin` string in CORS is fragile.**
   If the env var isn't set, it silently falls back to a wrong value.
   A hardcoded allowlist + regex wildcard is production-safe.

3. **`SameSite=Strict` breaks cross-origin sessions.**
   Frontend on Vercel + backend on Render = different sites.
   Cross-origin credentialed cookies require `SameSite=None; Secure`.

4. **Missing seed = empty production database.**
   A seed script that requires a manual step will always be forgotten
   on fresh database connections. Auto-seeding on startup solves this permanently.

5. **A `200 OK` with empty body can mask a completely wrong URL.**
   CDNs with SPA rewrites return `200` for all routes. Always verify in
   Network tab that the request hostname is the backend, not the frontend host.
