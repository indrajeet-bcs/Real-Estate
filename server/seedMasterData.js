// Seeds default master-data items per active firm (idempotent). Run: node seedMasterData.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import MasterDataItem from './src/models/MasterDataItem.js'

dotenv.config()

const DEFAULTS = {
  'lead-sources': ['Website', 'Walk-in', 'Referral', 'Social Media', 'Portal', 'Call'],
  'lead-statuses': ['New', 'Contacted', 'Qualified', 'Interested', 'Negotiation', 'Booked', 'Lost'],
  'property-types': ['Flat', 'Villa', 'Plot', 'Commercial', 'Penthouse', 'Row House'],
  'customer-types': ['Individual', 'Corporate', 'NRI', 'Investor'],
  'booking-sources': ['Direct', 'Channel Partner', 'Broker', 'Online'],
  'payment-modes': ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Card'],
  'expense-categories': ['Marketing', 'Travel', 'Office', 'Salaries', 'Utilities'],
  'marketing-activity-types': ['Online Campaign', 'Offline Promotion', 'Event', 'Print Media'],
  'site-visit-statuses': ['Scheduled', 'Completed', 'No Show', 'Rescheduled', 'Cancelled'],
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected. Seeding master data…')
  const firms = await Firm.find({ isDeleted: { $ne: true } }).lean()
  let created = 0
  for (const firm of firms) {
    let n = 0
    for (const [category, names] of Object.entries(DEFAULTS)) {
      for (const name of names) {
        const r = await MasterDataItem.updateOne(
          { firm: firm._id, category, name },
          { $setOnInsert: { firm: firm._id, category, name, active: true } },
          { upsert: true }
        )
        if (r.upsertedCount) n++
      }
    }
    created += n
    console.log(`  ${n > 0 ? '+' : '='} ${firm.name}: ${n} new items`)
  }
  console.log(`Done. ${created} master-data items created.`)
  await mongoose.connection.close(); process.exit(0)
}
run().catch(async (e) => { console.error(e); await mongoose.connection.close().catch(() => {}); process.exit(1) })
