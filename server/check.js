import { connectDB } from './src/config/db.js';
import User from './src/models/User.js';

connectDB().then(async () => {
  const superAdmin = await User.findOne({ email: 'superadmin@crm.local' });
  console.log('Super Admin DB role:', superAdmin ? superAdmin.role : 'NOT FOUND');
  
  const admin = await User.findOne({ email: 'admin@skylinerealty.com' });
  console.log('Admin DB role:', admin ? admin.role : 'NOT FOUND');

  const AuditLog = (await import('./src/models/AuditLog.js')).default;
  const logs = await AuditLog.find({ action: 'unauthorized_attempt' }).sort({ createdAt: -1 }).limit(1);
  console.log('Latest 403 audit log:', JSON.stringify(logs, null, 2));
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
