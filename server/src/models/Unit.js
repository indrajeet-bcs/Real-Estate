import mongoose from 'mongoose'
import { UNIT_STATUS } from '../config/constants.js'

const { Schema, model } = mongoose

// Inventory unit within a project. The unique index on (project, unitNumber)
// plus the status field back the double-booking prevention rule (§10).
const unitSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    unitNumber: { type: String, required: true, trim: true },
    unitType: { type: String, trim: true }, // 1BHK, 2BHK, plot-size...
    configuration: { type: String, trim: true }, // 1BHK / 2BHK / commercial / plot...
    propertyType: { type: String, trim: true }, // apartment / villa / plot / commercial
    floor: { type: String, trim: true },
    tower: { type: String, trim: true }, // tower / wing
    facing: { type: String, trim: true }, // E / W / N / S...
    parking: { type: String, trim: true }, // human summary (e.g. "2W 1 · 4W 1 Covered")
    twoWheelerParking: { type: String, trim: true }, // None | 1 | 2 | 3+
    fourWheelerParking: { type: String, trim: true }, // None | 1 Covered | 1 Open | 2 Covered | 2 Open
    areaSqft: { type: Number },
    price: { type: Number }, // legacy base price
    basePrice: { type: Number },
    currentPrice: { type: Number },
    discount: { type: Number, default: 0 }, // percentage off base
    status: {
      type: String,
      enum: Object.values(UNIT_STATUS),
      default: UNIT_STATUS.AVAILABLE,
      index: true,
    },
    // Set when reserved/booked — supports the "unit already reserved" block.
    reservedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    bookedFor: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    // Admin-flow port: temporary hold ("lock") for a lead, with auto-expiry.
    lockedForCustomer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    lockedUntil: { type: Date, default: null },
    lockReason: { type: String, trim: true },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Unit-transfer history (spec §Unit Transfer). Never deleted.
    transferHistory: [
      {
        at: { type: Date, default: () => new Date() },
        direction: { type: String, enum: ['in', 'out'] }, // this unit received / released the holding
        fromUnit: { type: Schema.Types.ObjectId, ref: 'Unit' },
        fromUnitNumber: { type: String, trim: true },
        toUnit: { type: Schema.Types.ObjectId, ref: 'Unit' },
        toUnitNumber: { type: String, trim: true },
        reason: { type: String, trim: true },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        byName: { type: String, trim: true },
      },
    ],

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

unitSchema.index({ project: 1, unitNumber: 1 }, { unique: true })

export default model('Unit', unitSchema)
