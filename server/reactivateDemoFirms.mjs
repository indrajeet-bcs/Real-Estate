// Admin data-fix: reactivate the 3 demo firms and their users so the documented
// demo logins (Password@123) work again. No passwords are changed.
import 'dotenv/config'
import mongoose from 'mongoose'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'

await mongoose.connect(process.env.MONGO_URI)
const NAMES = ['Skyline Realty', 'Metro Homes', 'Coastal Estates']
let firmsFixed = 0, usersFixed = 0
for (const name of NAMES) {
  const firm = await Firm.findOne({ name })
  if (!firm) { console.log(`  ? ${name}: not found`); continue }
  firm.isDeleted = false
  firm.status = 'active'
  firm.isActive = true
  await firm.save()
  firmsFixed++
  const r = await User.updateMany({ firm: firm._id }, { $set: { isActive: true } })
  usersFixed += r.modifiedCount
  console.log(`  + ${name}: reactivated (${r.modifiedCount} users re-enabled)`)
}
console.log(`Done. ${firmsFixed} firms, ${usersFixed} users reactivated.`)
await mongoose.connection.close()
