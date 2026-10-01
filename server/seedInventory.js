import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Builder from './src/models/Builder.js'
import Project from './src/models/Project.js'
import Unit from './src/models/Unit.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const monthsAhead = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); d.setDate(1); return d }

const AMENITIES = ['Parking', 'Club House', 'Gym', 'Garden', 'Swimming Pool', 'Security', "Children's Play Area", 'Power Backup', 'Lift', 'Jogging Track']
const LOCATIONS = ['Baner, Pune', 'Wakad, Pune', 'Hinjewadi, Pune', 'Kharadi, Pune', 'Viman Nagar, Pune', 'Andheri West, Mumbai', 'Powai, Mumbai', 'Whitefield, Bengaluru']
const STATUSES = ['pre_launch', 'under_construction', 'ready_to_move']
const CONTACTS = ['Rajesh Kumar', 'Sunita Rao', 'Amit Deshpande', 'Priya Menon', 'Vikas Shah']
const BUILDER_NAMES = ['Sunrise Developers', 'Green Valley Group', 'Skyline Constructions', 'Prestige Habitat', 'Landmark Builders', 'Pinnacle Realty']
const PROJECT_NAMES = ['Serene Heights', 'Orchid Residency', 'Emerald Towers', 'Sunrise Meadows', 'Palm Grove', 'Crystal Court', 'Maple Woods', 'Riverside Enclave']
const CONFIGS = [['1 BHK', 550, 40], ['2 BHK', 950, 70], ['3 BHK', 1350, 110], ['4 BHK', 1850, 160]] // [config, sqft, lakhBase]
const FACINGS = ['E', 'W', 'N', 'S', 'NE', 'SE']
const UNIT_STATES = ['available', 'available', 'available', 'available', 'hold', 'token', 'reserved', 'booked', 'blocked']

// Create extra builders/projects/units so the inventory browse is meaningful.
async function ensureInventory(firm) {
  const builderCount = await Builder.countDocuments({ firm: firm._id, isArchived: { $ne: true } })
  const makeBuilders = Math.max(0, 3 - builderCount)
  const newBuilderNames = sample(BUILDER_NAMES, makeBuilders)
  for (const name of newBuilderNames) {
    if (await Builder.findOne({ firm: firm._id, name })) continue
    await Builder.create({ firm: firm._id, name, about: `${name} is a trusted developer known for quality construction and timely delivery.`, contactPerson: pick(CONTACTS), phone: `9${randInt(100000000, 999999999)}`, email: `sales@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`, city: pick(['Pune', 'Mumbai', 'Bengaluru']) })
  }

  const builders = await Builder.find({ firm: firm._id, isArchived: { $ne: true } })
  const projectCount = await Project.countDocuments({ firm: firm._id, isArchived: { $ne: true } })
  const makeProjects = Math.max(0, 4 - projectCount)
  const usedNames = new Set((await Project.find({ firm: firm._id }).select('name').lean()).map((p) => p.name))
  for (const name of PROJECT_NAMES) {
    if (makeProjects <= 0) break
    if (usedNames.has(name)) continue
    const proj = await Project.create({
      firm: firm._id, name, builder: pick(builders)._id, location: pick(LOCATIONS),
      propertyType: 'apartment', description: `${name} offers thoughtfully designed homes with modern amenities and great connectivity.`,
      possessionDate: monthsAhead(randInt(6, 30)), reraNumber: `P52100${randInt(10000, 99999)}`,
      amenities: sample(AMENITIES, randInt(5, 8)), commissionRate: randInt(15, 30) / 10, constructionStatus: pick(STATUSES), status: 'active',
    })
    usedNames.add(name)
    // Units for this project across towers/floors/configs.
    const towers = ['A', 'B', 'C'].slice(0, randInt(2, 3))
    const docs = []
    for (const tower of towers) {
      for (let floor = 1; floor <= randInt(4, 8); floor++) {
        for (let u = 1; u <= randInt(2, 4); u++) {
          const [config, sqft, lakh] = pick(CONFIGS)
          const price = (lakh + randInt(-8, 20)) * 100000
          docs.push({
            firm: firm._id, project: proj._id, unitNumber: `${tower}-${floor}0${u}`,
            unitType: config, configuration: config, propertyType: 'apartment',
            floor: String(floor), tower, facing: pick(FACINGS), parking: '1 covered',
            areaSqft: sqft + randInt(-40, 80), basePrice: price, currentPrice: price, price,
            status: pick(UNIT_STATES),
          })
        }
      }
    }
    await Unit.insertMany(docs, { ordered: false }).catch(() => {})
  }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let bDone = 0, pDone = 0

    for (const firm of firms) {
      // Only enrich firms that have executives (the demo firms).
      const hasExecs = await User.countDocuments({ firm: firm._id, role: 'sales_executive', isActive: true })
      if (hasExecs) await ensureInventory(firm)

      const builders = await Builder.find({ firm: firm._id, isArchived: { $ne: true } })
      for (const b of builders) {
        let t = false
        if (!b.about) { b.about = `${b.name} is a trusted real-estate developer with a track record of quality residential and commercial projects delivered on time.`; t = true }
        if (!b.contactPerson) { b.contactPerson = pick(CONTACTS); t = true }
        if (!b.phone) { b.phone = `9${randInt(100000000, 999999999)}`; t = true }
        if (!b.email) { b.email = `sales@${b.name.toLowerCase().replace(/[^a-z]/g, '')}.com`; t = true }
        if (!b.city) { b.city = pick(['Pune', 'Mumbai', 'Bengaluru']); t = true }
        if (t) { await b.save(); bDone++ }
      }

      const projects = await Project.find({ firm: firm._id, isArchived: { $ne: true } })
      for (const p of projects) {
        let t = false
        if (!p.location) { p.location = pick(LOCATIONS); t = true }
        if (!p.possessionDate) { p.possessionDate = monthsAhead(randInt(6, 30)); t = true }
        if (!p.reraNumber) { p.reraNumber = `P52100${randInt(10000, 99999)}`; t = true }
        if (!p.description) { p.description = `${p.name} offers thoughtfully designed homes with modern amenities and excellent connectivity.`; t = true }
        if (!p.amenities || p.amenities.length === 0) { p.amenities = sample(AMENITIES, randInt(5, 8)); t = true }
        if (!p.constructionStatus) { p.constructionStatus = pick(STATUSES); t = true }
        if (t) { await p.save(); pDone++ }
      }
      console.log(`- ${firm.name}: builders ${builders.length}, projects ${projects.length} enriched`)
    }

    console.log(`\nDone. Builders enriched: ${bDone} · Projects enriched: ${pDone}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()
