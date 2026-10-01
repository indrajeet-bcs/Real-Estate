import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Announcement from './src/models/Announcement.js'
import NotificationHistory from './src/models/NotificationHistory.js'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'

dotenv.config()

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const superadmin = await User.findOne()
    if (!superadmin) {
      console.log('Super Admin not found. Run user seeder first.')
      process.exit(1)
    }

    const firms = await Firm.find().limit(3)
    if (firms.length === 0) {
      console.log('No companies found. Create some companies first to seed announcements.')
      process.exit(1)
    }

    const announcements = [
      {
        title: 'Scheduled Platform Maintenance',
        message: 'The CRM will undergo scheduled maintenance this Sunday between 2:00 AM and 4:00 AM UTC. Expect minor downtime.',
        audienceType: 'All Companies',
        status: 'Published',
        publishDate: new Date(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      {
        title: 'New CRM Feature Released',
        message: 'We are excited to announce the release of the new property matching algorithm. Check your dashboard for more details.',
        audienceType: 'All Companies',
        status: 'Published',
        publishDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        title: 'Subscription Renewal Reminder',
        message: 'This is a reminder that your enterprise subscription is coming up for renewal next month.',
        audienceType: 'Selected Companies',
        targetCompanies: [firms[0]._id],
        status: 'Draft',
      },
      {
        title: 'Security Update Notice',
        message: 'A critical security update has been applied to the platform. No action is required from your end.',
        audienceType: 'Selected Companies',
        targetCompanies: [firms[0]._id, firms[1]?._id].filter(Boolean),
        status: 'Published',
        publishDate: new Date(),
      },
      {
        title: 'Server Maintenance Window',
        message: 'Previous server maintenance window has concluded successfully.',
        audienceType: 'All Companies',
        status: 'Expired',
        publishDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      }
    ]

    for (const data of announcements) {
      const exists = await Announcement.findOne({ title: data.title })
      if (!exists) {
        data.createdBy = superadmin._id
        const ann = await Announcement.create(data)
        console.log(`Created announcement: ${data.title}`)

        if (ann.status === 'Published' || ann.status === 'Expired') {
          let targetIds = ann.targetCompanies
          if (ann.audienceType === 'All Companies') {
            targetIds = (await Firm.find({ isDeleted: false, status: 'active' }, '_id')).map(f => f._id)
          }
          await NotificationHistory.create({
            announcement: ann._id,
            audienceType: ann.audienceType,
            totalCompanies: targetIds.length,
            deliveryStatus: 'Delivered',
            targetCompanies: targetIds,
            sentBy: superadmin._id,
            sentDate: ann.publishDate || new Date()
          })
          console.log(`Created notification history for: ${data.title}`)
        }
      } else {
        console.log(`Announcement exists: ${data.title}`)
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
