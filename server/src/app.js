import express from 'express'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'

const app = express()

// Trust Render's reverse proxy so req.secure and IP headers are correct.
app.set('trust proxy', 1)

// ---------------------------------------------------------------------------
// CORS — manual middleware (replaces the cors npm package).
// The cors package's cached build on Render was serving stale code that
// threw 500 for cross-origin requests. Manual headers are bullet-proof.
// ---------------------------------------------------------------------------
const CORS_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5001',
  'https://real-estate-1-4d6s.onrender.com',
  'https://real-estate-frontend-5hm9.onrender.com',
  'https://real-estate-gamma-flame-64.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean))

function isOriginAllowed(origin) {
  if (!origin) return true                                    // server-to-server, curl
  if (CORS_ALLOWED_ORIGINS.has(origin)) return true          // exact allowlist match
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return true   // any *.onrender.com
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true     // any *.vercel.app
  return false
}

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-Requested-With,Accept,Origin'
    )
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  // Respond immediately to every OPTIONS preflight — no further processing needed.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
if (env.nodeEnv !== 'test') app.use(morgan('dev'))

// Serve uploaded files (documents, visit photos, agreements).
app.use('/uploads', express.static('uploads'))

app.get('/', (_req, res) => {
  // Version tag helps verify the deployed build on Render.
  res.json({ name: 'Real Estate CRM API', version: '1.0.1', docs: '/api/health' })
})

app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

export default app
