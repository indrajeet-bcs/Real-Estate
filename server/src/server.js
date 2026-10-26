import app from './app.js'
import { env } from './config/env.js'
import { connectDB } from './config/db.js'

async function start() {
  try {
    await connectDB()
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
