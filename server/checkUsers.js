import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User.js';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'user1@skylinerealty.com' }).select('+password');
    if (!user) {
      console.log('User not found!');
    } else {
      console.log('User found:');
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- IsActive:', user.isActive);
      
      const isMatch = await user.comparePassword('Password@123');
      console.log('- Password Matches "Password@123":', isMatch);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
