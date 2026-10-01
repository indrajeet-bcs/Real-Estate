import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'

const app = express()

app.use(
  cors({
    origin: env.clientUrl,
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
