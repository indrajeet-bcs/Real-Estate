import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User.js';

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'user1@skylinerealty.com' });
    if (!user) {
      console.log('User not found!');
    } else {
      user.password = 'Password@123';
      await user.save();
      console.log('Password reset to Password@123 for user1@skylinerealty.com');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
