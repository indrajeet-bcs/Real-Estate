import mongoose from 'mongoose'

const { Schema, model } = mongoose

const notificationHistorySchema = new Schema(
  {
    notificationId: { type: String, unique: true },
    announcement: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true },
    audienceType: { type: String, required: true },
    totalCompanies: { type: Number, default: 0 },
    deliveryStatus: { type: String, enum: ['Pending', 'Delivered', 'Failed'], default: 'Pending' },
    targetCompanies: [{ type: Schema.Types.ObjectId, ref: 'Firm' }],
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Generate sequential notificationId
notificationHistorySchema.pre('save', async function (next) {
  if (!this.isNew) return next()
  try {
    const last = await this.constructor.findOne({}, 'notificationId').sort({ createdAt: -1 })
    if (last && last.notificationId && last.notificationId.startsWith('NOTIF-')) {
      const lastNum = parseInt(last.notificationId.split('-')[1], 10)
      this.notificationId = `NOTIF-${lastNum + 1}`
    } else {
      this.notificationId = 'NOTIF-1001'
    }
    next()
  } catch (err) {
    next(err)
  }
})

export default model('NotificationHistory', notificationHistorySchema)
