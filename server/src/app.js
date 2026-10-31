import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'

const app = express()

// Trust Render's reverse proxy so req.secure and IP headers are correct.
app.set('trust proxy', 1)

// Explicit allowlist + *.onrender.com and *.vercel.app wildcards for production & preview deployments.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5001',
  'https://real-estate-1-4d6s.onrender.com',       // Render production frontend
  'https://real-estate-frontend-5hm9.onrender.com', // Render static frontend
  'https://real-estate-gamma-flame-64.vercel.app',  // Vercel production
  env.clientUrl,                                     // Whatever CLIENT_URL is set to on Render
].filter(Boolean))

function isOriginAllowed(origin) {
  // Allow server-to-server / curl requests that send no Origin header.
  if (!origin) return true
  // Exact match from the allowlist.
  if (ALLOWED_ORIGINS.has(origin)) return true
  // Wildcard: any Render frontend deployment (e.g. https://real-estate-xxx.onrender.com)
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return true
  // Wildcard: any Vercel preview URL (e.g. https://real-estate-xxx.vercel.app)
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true
  return false
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, true)
      }
      // Omit CORS headers gracefully instead of throwing 500 error on disallowed origin
      return callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    optionsSuccessStatus: 204,
  })
)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
if (env.nodeEnv !== 'test') app.use(morgan('dev'))

// Serve uploaded files (documents, visit photos, agreements).
app.use('/uploads', express.static('uploads'))

app.get('/', (_req, res) => {
  res.json({ name: 'Real Estate CRM API', version: '1.0.0', docs: '/api/health' })
})

app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

export default app
