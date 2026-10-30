import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load from server/.env first, then fallback to current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config()

const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']
for (const key of required) {
  if (!process.env[key] && !process.env.MONGODB_URI) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Warning: ${key} is not set. Check your .env file.`)
  }
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/real_estate_crm',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  sessionIdleTimeoutMin: Number(process.env.SESSION_IDLE_TIMEOUT_MIN) || 30,

  seed: {
    name: process.env.SEED_SUPERADMIN_NAME || 'Platform Owner',
    email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@crm.local',
    password: process.env.SEED_SUPERADMIN_PASSWORD || 'SuperAdmin@123',
  },
}

export const isProd = env.nodeEnv === 'production'
