import mongoose from 'mongoose'

const { Schema, model } = mongoose

const ticketSchema = new Schema(
  {
    ticketId: { type: String, unique: true },
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true },
    subject: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'TicketCategory', required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'], default: 'Open' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'SupportMember' },
    description: { type: String, required: true },
    internalNotes: [{
      note: { type: String, required: true },
      addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now }
    }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

// Generate sequential ticketId like TKT-1001
ticketSchema.pre('save', async function (next) {
  if (!this.isNew) return next()
  try {
    const lastTicket = await this.constructor.findOne({}, 'ticketId').sort({ createdAt: -1 })
    if (lastTicket && lastTicket.ticketId && lastTicket.ticketId.startsWith('TKT-')) {
      const lastNum = parseInt(lastTicket.ticketId.split('-')[1], 10)
      this.ticketId = `TKT-${lastNum + 1}`
    } else {
      this.ticketId = 'TKT-1001'
    }
    next()
  } catch (err) {
    next(err)
  }
})

export default model('Ticket', ticketSchema)
