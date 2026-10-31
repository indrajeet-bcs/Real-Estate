import app from './app.js'
import { env } from './config/env.js'
import { connectDB, disconnectDB } from './config/db.js'

async function start() {
  try {
    // eslint-disable-next-line no-console
    console.log('[server] Initializing database connection...')

    await connectDB()

    const server = app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Real Estate CRM API running on http://localhost:${env.port} (${env.nodeEnv})`)
    })

    const shutdown = async (signal) => {
      // eslint-disable-next-line no-console
      console.log(`\n[server] Received ${signal}. Shutting down gracefully...`)
      server.close(async () => {
        await disconnectDB()

        process.exit(0)
      })
    }


    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] Failed to start application:', err.message)
    process.exit(1)
  }
}

start()

