// DEV TEST HELPER (read-only): signs a valid access token for an EXISTING ACTIVE
// user so operational (firm-scoped) endpoints can be smoke-tested locally without
// changing anyone's password. Usage: node mintTestToken.mjs <email>
import 'dotenv/config'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import { signAccessToken } from './src/utils/token.js'

const email = process.argv[2]
await mongoose.connect(process.env.MONGO_URI)
const u = await User.findOne({ email })
if (!u) { console.error('NOTFOUND'); process.exit(2) }
if (!u.isActive) { console.error('INACTIVE'); process.exit(3) }
process.stdout.write(signAccessToken(u))
await mongoose.connection.close()
