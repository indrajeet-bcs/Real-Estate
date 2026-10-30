import mongoose from 'mongoose'
import { env } from './env.js'

/**
 * Mask sensitive credentials from MongoDB URI for secure logging
 * Example: mongodb+srv://user:secret@cluster.mongodb.net/ -> mongodb+srv://user:*****@cluster.mongodb.net/
 */
export function maskMongoUri(uri) {
  if (!uri) return '(not provided)'
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:*****@')
  } catch {
    return '***'
  }
}

let listenersConfigured = false

function setupMongooseListeners() {
  if (listenersConfigured) return
  listenersConfigured = true

  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('[db] Mongoose connection open to cluster')
  })

  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] Mongoose runtime connection error:', err.message)
  })

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[db] Mongoose connection disconnected')
  })
}

/**
 * Establishes connection to MongoDB Atlas or local MongoDB instance
 */
export async function connectDB() {
  mongoose.set('strictQuery', true)
  setupMongooseListeners()

  const mongoUri = env.mongoUri
  if (!mongoUri) {
    const errorMsg = '[db] MongoDB connection error: MONGO_URI environment variable is not defined.'
    // eslint-disable-next-line no-console
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  // eslint-disable-next-line no-console
  console.log(`[db] Connecting to MongoDB: ${maskMongoUri(mongoUri)}`)

  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds if cluster is unreachable
    autoIndex: env.nodeEnv !== 'production',
  }

  try {
    const conn = await mongoose.connect(mongoUri, mongooseOptions)
    // eslint-disable-next-line no-console
    console.log(`[db] MongoDB connected successfully: host=${conn.connection.host}, database=${conn.connection.name || 'default'}`)
    return conn
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[db] MongoDB connection failed: ${err.message}`)

    // Specific guidance for common MongoDB Atlas failure modes
    if (err.name === 'MongooseServerSelectionError' || err.message.includes('Could not connect to any servers')) {
      // eslint-disable-next-line no-console
      console.error('[db] [Atlas Diagnostic] IP Whitelist issue detected. Ensure your current client IP is added to the MongoDB Atlas "Network Access" IP Access List (or 0.0.0.0/0 for global dev access).')
    } else if (err.message.includes('bad auth') || err.message.includes('AuthenticationFailed')) {
      // eslint-disable-next-line no-console
      console.error('[db] [Atlas Diagnostic] Authentication failed. Please verify your database username and password in MONGO_URI.')
    } else if (err.message.includes('querySrv') || err.message.includes('ENOTFOUND')) {
      // eslint-disable-next-line no-console
      console.error('[db] [Atlas Diagnostic] DNS lookup failed. Please verify your MongoDB connection string hostname.')
    }

    throw err
  }
}

/**
 * Gracefully close MongoDB connection (useful for testing and graceful shutdown)
 */
export async function disconnectDB() {
  try {
    await mongoose.disconnect()
    // eslint-disable-next-line no-console
    console.log('[db] MongoDB disconnected gracefully')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] Error disconnecting MongoDB:', err.message)
  }
}

