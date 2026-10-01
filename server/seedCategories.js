import mongoose from 'mongoose'
import dotenv from 'dotenv'
import TicketCategory from './src/models/TicketCategory.js'

dotenv.config()

const categories = [
  'Technical Issue',
  'Billing & Subscription',
  'Account & Login',
  'Company Management',
  'Bug Report',
  'Feature Request',
  'Data Import / Export',
  'Other'
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/real-estate-crm')
    console.log('Connected to MongoDB')
    
    for (const name of categories) {
      const exists = await TicketCategory.findOne({ name })
      if (!exists) {
        await TicketCategory.create({ name, isDefault: true })
        console.log(`Created category: ${name}`)
      } else {
        console.log(`Category exists: ${name}`)
      }
    }
    
    console.log('Seeding complete')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()
