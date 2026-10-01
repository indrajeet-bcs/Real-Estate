import 'dotenv/config'
import { connectDB } from '../config/db.js'
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import { ROLES } from '../config/constants.js'

const companyNames = [
  'Skyline Realty', 'Prime Properties', 'Urban Nest', 'Elite Estates', 'Dream Homes',
  'BlueStone Realty', 'Golden Brick Developers', 'Metro Spaces', 'Horizon Infra', 'Royal Heights',
  'City Square Realty', 'NextHome Developers', 'Silver Oak Realty', 'Future Habitat', 'Smart Living Developers',
  'Sunrise Realty', 'Vertex Properties', 'Capital Homes', 'Infinity Infra', 'Green Valley Realty'
]

const adminNames = [
  'Rahul Sharma', 'Sneha Patil', 'Amit Shah', 'Priya Joshi', 'Rohan Deshmukh',
  'Neha Kulkarni', 'Karan Mehta', 'Anjali Verma', 'Vivek Singh', 'Pooja Jain',
  'Vikram Rathore', 'Aarti Desai', 'Suresh Nair', 'Anita Reddy', 'Rajiv Menon',
  'Kavita Iyer', 'Manish Tiwari', 'Swati Gupta', 'Arun Kumar', 'Divya Bose'
]

const mobilePrefixes = ['98', '99', '97', '96', '95', '91', '89', '88', '87', '70']

function getRandomMobile() {
  const prefix = mobilePrefixes[Math.floor(Math.random() * mobilePrefixes.length)]
  const rest = Math.floor(10000000 + Math.random() * 90000000).toString()
  return `+91 ${prefix}${rest}`
}

const plans = [
  { name: 'Starter', limit: 5, storage: 5 },
  { name: 'Professional', limit: 25, storage: 10 },
  { name: 'Enterprise', limit: 100, storage: 50 },
  { name: 'Enterprise Plus', limit: -1, storage: 500 }
]

const userCounts = [2, 5, 8, 15, 24, 40, 76, 120, 250]
const storageUsage = [0.5, 2.4, 4.8, 8, 12, 22, 48, 120, 300, 495]

// Target distributions (out of 20)
const statusDist = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'trial', 'trial', 'trial', 'trial', 'suspended', 'suspended', 'suspended', 'deleted', 'deleted', 'deleted']
const subDist = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'trial', 'trial', 'trial', 'trial', 'expired', 'expired', 'expired', 'cancelled', 'cancelled', 'cancelled']
const cycleDist = ['monthly', 'monthly', 'monthly', 'monthly', 'monthly', 'monthly', 'monthly', 'monthly', 'yearly', 'yearly', 'yearly', 'yearly', 'yearly', 'yearly', 'yearly', 'yearly', 'monthly', 'monthly', 'yearly', 'yearly']

// Random date within last year
function getRandomDate() {
  const now = new Date()
  const daysAgo = Math.floor(Math.random() * 365)
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
}

async function run() {
  await connectDB()
  console.log('Connected to DB')

  const superAdmin = await User.findOne({ role: ROLES.SUPER_ADMIN })
  if (!superAdmin) {
    console.error('No super admin found')
    process.exit(1)
  }

  // Clear existing firms and non-super-admin users
  await Firm.deleteMany({})
  await User.deleteMany({ role: { $ne: ROLES.SUPER_ADMIN } })
  console.log('Cleared old data')

  for (let i = 0; i < 20; i++) {
    const cName = companyNames[i]
    const aName = adminNames[i]
    const email = aName.split(' ')[0].toLowerCase() + '@' + cName.split(' ')[0].toLowerCase() + '.com'
    const mobile = getRandomMobile()

    // Select plan appropriately to cover user limit examples
    let planObj
    let uCount
    let sUsed

    if (i < 5) {
      planObj = plans[0] // Starter (Limit 5)
      uCount = i % 2 === 0 ? 2 : 5
      sUsed = 0.5
    } else if (i < 12) {
      planObj = plans[1] // Professional (Limit 25)
      uCount = [8, 15, 24][i % 3]
      sUsed = [2.4, 4.8, 8][i % 3]
    } else if (i < 17) {
      planObj = plans[2] // Enterprise (Limit 100)
      uCount = [40, 76][i % 2]
      sUsed = [12, 22, 48][i % 3]
    } else {
      planObj = plans[3] // Enterprise Plus (Unlimited)
      uCount = [120, 250][i % 2]
      sUsed = [120, 300, 495][i % 3]
    }

    const stat = statusDist[i]
    const subStat = subDist[i]
    const cycle = cycleDist[i]
    const createdAt = getRandomDate()

    const firm = await Firm.create({
      companyId: `CMP-${1001 + i}`,
      name: cName,
      plan: planObj.name.toLowerCase(),
      billingCycle: cycle,
      status: stat,
      subscriptionStatus: subStat,
      storageUsed: sUsed,
      storageLimit: planObj.storage,
      allowedUsers: planObj.limit,
      isDeleted: stat === 'deleted',
      isActive: stat === 'active' || stat === 'trial',
      contactEmail: email,
      contactPhone: mobile,
      createdBy: superAdmin._id,
      createdAt
    })

    // Create Admin
    await User.create({
      name: aName,
      email: email,
      password: 'Password@123',
      role: ROLES.ADMIN,
      firm: firm._id,
      phone: mobile,
      isActive: firm.isActive,
      createdAt
    })

    // Create remaining mock users for user count
    // (We only insert up to 5 additional users to not overload DB with thousands of docs,
    // but we will manually update `currentUsers` logic if needed. 
    // Wait, `firm.controller.js` calculates users from DB dynamically.
    // If we want 120 users, we MUST insert 120 users or adjust the controller to mock it.
    // Since this is for demo, inserting 120 lightweight users takes 10ms. Let's do it!)
    
    const staffToCreate = []
    for (let j = 1; j < uCount; j++) {
      staffToCreate.push({
        name: `User ${j}`,
        email: `user${j}@` + email.split('@')[1],
        password: 'Password@123',
        role: ROLES.SALES_EXECUTIVE,
        firm: firm._id,
        isActive: firm.isActive,
        createdAt
      })
    }
    
    if (staffToCreate.length > 0) {
      await User.insertMany(staffToCreate)
    }

    console.log(`Created ${firm.companyId} - ${firm.name} with ${uCount} users`)
  }

  console.log('Successfully seeded 20 companies')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
