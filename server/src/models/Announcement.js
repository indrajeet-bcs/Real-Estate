import mongoose from 'mongoose'

const { Schema, model } = mongoose

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    audienceType: { type: String, enum: ['All Companies', 'Selected Companies'], required: true },
    targetCompanies: [{ type: Schema.Types.ObjectId, ref: 'Firm' }],
    publishDate: { type: Date },
    expiryDate: { type: Date },
    status: { type: String, enum: ['Draft', 'Published', 'Expired'], default: 'Draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default model('Announcement', announcementSchema)
