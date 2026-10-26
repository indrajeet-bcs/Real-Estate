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

// Explicit allowlist + *.vercel.app wildcard for preview deployments.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5001',
  'https://real-estate-gamma-flame-64.vercel.app',  // Vercel production
  'https://real-estate-frontend-5hm9.onrender.com', // Render static frontend
  env.clientUrl,                                     // Whatever CLIENT_URL is set to on Render
].filter(Boolean))

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server / curl requests that send no Origin header.
      if (!origin) return callback(null, true)
      // Exact match from the allowlist.
      if (ALLOWED_ORIGINS.has(origin)) return callback(null, true)
      // Wildcard: any Vercel preview URL (e.g. real-estate-xxx.vercel.app).
      if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return callback(null, true)
      callback(new Error(`CORS: origin '${origin}' not allowed`))
    },
    credentials: true,
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
