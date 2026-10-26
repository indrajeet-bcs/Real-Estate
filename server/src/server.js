import app from './app.js'
import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import { runStartupSeed } from './utils/startupSeed.js'

async function start() {
  try {
    await connectDB()
    // Ensure baseline accounts exist in the DB on every boot (idempotent — safe to re-run).
    await runStartupSeed()
    app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Real Estate CRM API running on http://localhost:${env.port} (${env.nodeEnv})`)
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] Failed to start:', err.message)
    process.exit(1)
  }
}

start()
