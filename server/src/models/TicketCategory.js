import mongoose from 'mongoose'

const { Schema, model } = mongoose

const ticketCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export default model('TicketCategory', ticketCategorySchema)
