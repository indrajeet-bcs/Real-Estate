import mongoose from 'mongoose'
import dotenv from 'dotenv'
import SupportMember from './src/models/SupportMember.js'

dotenv.config()

const members = [
  { name: 'Rahul Sharma', role: 'Support Manager', email: 'rahul.sharma@yourcrm.com', mobile: '+91 98765 10001' },
  { name: 'Priya Patil', role: 'Senior Support Agent', email: 'priya.patil@yourcrm.com', mobile: '+91 98765 10002' },
  { name: 'Amit Verma', role: 'Support Agent', email: 'amit.verma@yourcrm.com', mobile: '+91 98765 10003' },
  { name: 'Sneha Joshi', role: 'Support Agent', email: 'sneha.joshi@yourcrm.com', mobile: '+91 98765 10004' },
  { name: 'Karan Mehta', role: 'Support Agent', email: 'karan.mehta@yourcrm.com', mobile: '+91 98765 10005' },
  { name: 'Neha Kulkarni', role: 'Support Agent', email: 'neha.kulkarni@yourcrm.com', mobile: '+91 98765 10006' },
  { name: 'Vivek Singh', role: 'Senior Support Agent', email: 'vivek.singh@yourcrm.com', mobile: '+91 98765 10007' },
  { name: 'Pooja Desai', role: 'Support Agent', email: 'pooja.desai@yourcrm.com', mobile: '+91 98765 10008' },
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/real-estate-crm')
    console.log('Connected to MongoDB')
    
    for (const data of members) {
      const exists = await SupportMember.findOne({ email: data.email })
      if (!exists) {
        await SupportMember.create(data)
        console.log(`Created member: ${data.name}`)
      } else {
        console.log(`Member exists: ${data.name}`)
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
