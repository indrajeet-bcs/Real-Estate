# 📋 Diagnostic Survey Report: Full-Stack Login Issue on Render

**Date:** 2026-10-26  
**Application:** Real Estate CRM (Node.js/Express Backend + React/Vite Frontend)  
**Deployment Environment:** Render (Web Service + Static Site)  
**Status:** Diagnosed & Documented with Exact Code Fixes  

---

## 1. Executive Summary & Root Cause Analysis

### The Reported Symptom
- Frontend makes `POST /api/auth/login`.
- Network tab reports HTTP status **`200 OK`** with **`Content-Length: 0`** and an empty response body.
- The UI triggers the `catch` block and displays `"Login failed. Please try again."` without printing any error to the browser console.

---

### Key Findings & Smoking Gun

#### 🔍 Root Cause 1: Request Misdirection to Render Static Site Host (Primary Cause)
In the committed code deployed to Render (Commit `cad707a`):
- [my-app/src/api/client.js](file:///d:/My%20Projects/Real%20Estate/my-app/src/api/client.js#L5) was hardcoded to:
  ```javascript
  const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
  })
  ```
- Although `my-app/.env` was created with `VITE_API_URL=https://real-estate-0kga.onrender.com`, `client.js` in the deployed branch never referenced `import.meta.env.VITE_API_URL`.
- Consequently, when running on the live frontend domain (e.g. `https://<frontend-app>.onrender.com`), the browser sent:
  ```http
  POST https://<frontend-app>.onrender.com/api/auth/login
  ```
- **Why `200 OK` with `Content-Length: 0`?**  
  Render Static Sites (and CDN edge proxies with SPA rewrites) only serve static assets (`GET`/`HEAD`). When an HTTP `POST` is sent to a static site route, Render's static file server absorbs the request, treats it as a static route match, and returns a **`200 OK`** with an empty body (`Content-Length: 0`). **The request never reached your Express backend at all.**

---

#### 🔍 Root Cause 2: Silent Client-Side Exception Swallowed in UI
In [my-app/src/context/AuthContext.jsx](file:///d:/My%20Projects/Real%20Estate/my-app/src/context/AuthContext.jsx#L53-L58):
```javascript
const login = useCallback(async (email, password) => {
  const { data } = await authApi.login(email, password)
  setAccessToken(data.data.accessToken) // 💥 Throws TypeError if data is empty string or undefined
  setUser(data.data.user)
  setPermissions(data.data.permissions || {})
  return data.data.user
}, [])
```
When Axios receives a `200 OK` with an empty response body, `response.data` is `""`.
Accessing `data.data.accessToken` throws:
```text
TypeError: Cannot read properties of undefined (reading 'accessToken')
```
In [my-app/src/pages/auth/LoginPage.jsx](file:///d:/My%20Projects/Real%20Estate/my-app/src/pages/auth/LoginPage.jsx#L28-L30):
```javascript
} catch (err) {
  setError(err.response?.data?.message || 'Login failed. Please try again.')
}
```
1. `err` is a JavaScript runtime `TypeError`, not an Axios HTTP error response.
2. `err.response` is `undefined`, so `err.response?.data?.message` evaluates to `undefined`.
3. It defaults to `'Login failed. Please try again.'`.
4. Because `console.error(err)` was omitted, the error was never logged to the browser console.

---

#### 🔍 Root Cause 3: Backend Cross-Site Cookie Incompatibility on Render
In [server/src/controllers/auth.controller.js](file:///d:/My%20Projects/Real%20Estate/server/src/controllers/auth.controller.js#L19-L27):
```javascript
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax', // ⚠️ FAILS in cross-site production
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  }
}
```
- In Render deployments, frontend (`frontend.onrender.com`) and backend (`real-estate-0kga.onrender.com`) reside on different subdomains. Modern browsers treat different subdomains under public suffix domains as **cross-site**.
- A cookie with `SameSite=Strict` will be **rejected** by modern browsers when set across different sites with credentials.
- In production, cross-origin cookies **MUST** have `sameSite: 'none'` and `secure: true`.

---

#### 🔍 Root Cause 4: Missing Reverse Proxy Trust in Express
In [server/src/app.js](file:///d:/My%20Projects/Real%20Estate/server/src/app.js):
`app.set('trust proxy', 1)` is missing.
- Render sits behind reverse proxies (Cloudflare/Envoy).
- Without proxy trust, `express-rate-limit` uses the proxy IP for all users, which can throttle or block legitimate requests under load.
- Express cannot accurately verify HTTPS protocols (`req.secure`).

---

## 2. Exact Code Fixes

### Fix A: Frontend — Dynamic API Client Configuration
Update [my-app/src/api/client.js](file:///d:/My%20Projects/Real%20Estate/my-app/src/api/client.js):
Ensure `baseURL` properly consumes `import.meta.env.VITE_API_URL` while keeping the local proxy fallback (`/api`) for development.

```javascript
import axios from 'axios'

// Resolve API base URL:
// 1. In production, VITE_API_URL is supplied by Render (e.g., https://real-estate-0kga.onrender.com/api)
// 2. In local development, defaults to '/api' which Vite proxies to localhost:5001
const rawUrl = (import.meta.env.VITE_API_URL || '/api').trim()
const baseURL = (rawUrl.startsWith('http') && !rawUrl.endsWith('/api') && !rawUrl.endsWith('/api/'))
  ? `${rawUrl.replace(/\/+$/, '')}/api`
  : rawUrl.replace(/\/+$/, '')

const api = axios.create({
  baseURL,
  withCredentials: true,
})
```

---

### Fix B: Frontend — Defensive Login Response Handling & Error Logging
Update [my-app/src/context/AuthContext.jsx](file:///d:/My%20Projects/Real%20Estate/my-app/src/context/AuthContext.jsx#L52-L59):
Validate that `data` and `data.data` exist before reading properties.

```javascript
  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    const payload = res?.data?.data

    if (!payload?.accessToken || !payload?.user) {
      throw new Error('Invalid response structure received from server')
    }

    setAccessToken(payload.accessToken)
    setUser(payload.user)
    setPermissions(payload.permissions || {})
    return payload.user
  }, [])
```

Update [my-app/src/pages/auth/LoginPage.jsx](file:///d:/My%20Projects/Real%20Estate/my-app/src/pages/auth/LoginPage.jsx#L28-L32):
Log the error to console and display meaningful error messages:

```javascript
    } catch (err) {
      console.error('[Login Error]', err)
      setError(
        err.response?.data?.message ||
        err.message ||
        'Login failed. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
```

---

### Fix C: Backend — Cross-Site Cookie Configuration
Update [server/src/controllers/auth.controller.js](file:///d:/My%20Projects/Real%20Estate/server/src/controllers/auth.controller.js#L19-L27):
Use `sameSite: isProd ? 'none' : 'lax'` and `secure: isProd` so cookies work across Render subdomains.

```javascript
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax', // 'none' required for cross-origin cookies over HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    path: '/api/auth',
  }
}
```

---

### Fix D: Backend — Trust Proxy & Robust CORS
Update [server/src/app.js](file:///d:/My%20Projects/Real%20Estate/server/src/app.js#L9-L16):

```javascript
const app = express()

// Trust Render reverse proxy for accurate IP & secure cookie transmission
app.set('trust proxy', 1)

// Dynamic or configured CORS origin
const allowedOrigins = [
  env.clientUrl,
  env.clientUrl?.replace(/\/+$/, ''),
  'http://localhost:5173',
  'http://localhost:5001',
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
        return callback(null, true)
      }
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)
```

---

## 3. Deployment Configuration Checklist (Render Dashboard)

| Service | Environment Variable | Required Value | Purpose |
|---|---|---|---|
| **Frontend (Static Site)** | `VITE_API_URL` | `https://real-estate-0kga.onrender.com/api` | Baked into Vite JS bundle during `vite build` |
| **Backend (Web Service)** | `CLIENT_URL` | `https://<your-frontend-subdomain>.onrender.com` | Allowed origin for CORS & cookie sharing |
| **Backend (Web Service)** | `NODE_ENV` | `production` | Enables HTTPS-only flags & production security |

> ⚠️ **Important Vite Build Note:** Vite bundles environment variables at **build time**. Whenever `VITE_API_URL` is changed in Render's dashboard, trigger a **Manual Deploy -> Clear build cache & deploy** on the Frontend static site.
