import mongoose from 'mongoose';
import AuditLog from './src/models/AuditLog.js';

mongoose.connect('mongodb://localhost:27017/realestate').then(async () => {
  const logs = await AuditLog.find({ action: 'unauthorized_attempt' }).sort({ createdAt: -1 }).limit(5);
  console.log(JSON.stringify(logs, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
