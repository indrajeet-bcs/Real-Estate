import mongoose from 'mongoose'

const { Schema, model } = mongoose

const supportMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true },
    mobile: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default model('SupportMember', supportMemberSchema)
