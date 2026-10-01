import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'

dotenv.config()

// Un-delete soft-deleted firms and restore a sensible company status from their
// subscription status (so the Company Management list shows them again).
async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const deleted = await Firm.find({ $or: [{ isDeleted: true }, { status: 'deleted' }] })
    let restored = 0
    for (const f of deleted) {
      f.isDeleted = false
      f.status = f.subscriptionStatus === 'trial' ? 'trial'
        : ['expired', 'cancelled'].includes(f.subscriptionStatus) ? 'suspended'
        : 'active'
      await f.save()
      restored++
    }

    const live = await Firm.countDocuments({ isDeleted: false })
    console.log(`\nRestored ${restored} firm(s). Live (visible) firms now: ${live}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
