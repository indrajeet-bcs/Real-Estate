import mongoose from 'mongoose'
import {
  BOOKING_STATUS, PAYMENT_MODE, PAYMENT_STATUS, REGISTRATION_STATUS, DISCOUNT_GIVEN_BY, DISCOUNT_SOURCE,
} from '../config/constants.js'

const { Schema, model } = mongoose

const paymentMilestoneSchema = new Schema(
  {
    label: { type: String, trim: true }, // e.g. "Token", "On agreement", "Possession"
    amount: { type: Number, required: true },
    dueDate: { type: Date },
    paidDate: { type: Date },
    paid: { type: Boolean, default: false },
  },
  { _id: true }
)

// A recorded payment entry (spec §Payment Information · Payment History).
const paymentEntrySchema = new Schema(
  {
    date: { type: Date, default: () => new Date() },
    amount: { type: Number, required: true },
    mode: { type: String, enum: PAYMENT_MODE, default: 'other' },
    reference: { type: String, trim: true }, // transaction / cheque reference
    receiptNumber: { type: String, trim: true },
    receiptUrl: { type: String, trim: true }, // uploaded payment receipt
    remarks: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, _id: true }
)

// An uploaded booking document (spec §Documents).
const bookingDocumentSchema = new Schema(
  {
    label: { type: String, trim: true },
    category: { type: String, trim: true }, // booking_form | kyc | agreement | receipt | other
    fileName: String,
    fileUrl: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// Employee-raised discount request awaiting approval (spec §Request Discount /
// §Discount Section). Employees enter the breakdown but cannot approve it.
const discountRequestSchema = new Schema(
  {
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    saleAmount: { type: Number, default: 0 },
    givenBy: { type: String, enum: DISCOUNT_GIVEN_BY },
    builderSalesExecutive: { type: String, trim: true },
    source: { type: String, enum: DISCOUNT_SOURCE },
    firmDiscount: { type: Number, default: 0 },
    builderDiscount: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    finalSaleAmount: { type: Number, default: 0 },
    remarks: { type: String, trim: true },
    supportingDocument: { label: { type: String, trim: true }, fileName: String, fileUrl: String },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedByName: { type: String, trim: true },
    requestedAt: { type: Date, default: () => new Date() },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedByName: { type: String, trim: true },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true },
  },
  { _id: false }
)

// Employee-raised cancellation request awaiting approval (spec §Request Booking
// Cancellation · Approval Flow: Employee → Sub-Admin → Admin).
const cancellationRequestSchema = new Schema(
  {
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reason: { type: String, trim: true },
    remarks: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedByName: { type: String, trim: true },
    requestedAt: { type: Date, default: () => new Date() },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedByName: { type: String, trim: true },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true },
  },
  { _id: false }
)

// Full discount breakdown (spec §Discount Information). Firm & builder shares are
// stored as absolute ₹ amounts; finalSaleAmount is the authoritative sale value.
const discountDetailSchema = new Schema(
  {
    saleAmount: { type: Number, default: 0 }, // base/list price before discount
    givenBy: { type: String, enum: DISCOUNT_GIVEN_BY },
    builderSalesExecutive: { type: String, trim: true }, // shown when givenBy = builder_sales_executive
    source: { type: String, enum: DISCOUNT_SOURCE },
    firmDiscount: { type: Number, default: 0 },
    builderDiscount: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    finalSaleAmount: { type: Number, default: 0 },
    remarks: { type: String, trim: true },
    supportingDocument: {
      label: { type: String, trim: true },
      fileName: String,
      fileUrl: String,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date },
  },
  { _id: false }
)

// Immutable discount-change log (spec §Discount History). Stores a snapshot at
// each add/update/remove, plus previous/updated values on edits.
const discountHistorySchema = new Schema(
  {
    at: { type: Date, default: () => new Date() },
    action: { type: String, enum: ['added', 'updated', 'removed'], required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    givenBy: { type: String, trim: true },
    builderSalesExecutive: { type: String, trim: true },
    source: { type: String, trim: true },
    saleAmount: { type: Number },
    firmDiscount: { type: Number },
    builderDiscount: { type: Number },
    totalDiscount: { type: Number },
    finalSaleAmount: { type: Number },
    remarks: { type: String, trim: true },
    previousValue: { type: Schema.Types.Mixed },
    updatedValue: { type: Schema.Types.Mixed },
  },
  { _id: true }
)

// A booking ties a customer to a specific unit. Creation enforces the
// double-booking block (§10). Notifies executive/sub-admin/admin on completion.
const bookingSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    builder: { type: Schema.Types.ObjectId, ref: 'Builder', default: null },
    unit: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },

    bookingAmount: { type: Number, required: true },
    paymentMode: { type: String, enum: PAYMENT_MODE, default: 'other' },
    bookingDate: { type: Date }, // employee-entered booking date (§Create Booking)
    notes: { type: String, trim: true },
    totalValue: { type: Number },
    // Admin-flow port: discount %, escrow token, computed brokerage, RERA sign-off.
    appliedDiscount: { type: Number, default: 0 }, // percentage
    amountReceived: { type: Number, default: 0 }, // escrow token deposit
    commissionEarned: { type: Number, default: 0 },
    // The commission rule applied at booking time (spec: stored with the booking;
    // shown in the Commission Report). Kept as-is even if the rule later changes.
    commissionRule: { type: Schema.Types.ObjectId, ref: 'CommissionRule', default: null },
    commissionRuleName: { type: String, trim: true },
    reraVerified: { type: Boolean, default: false },

    bookingSource: { type: String, trim: true, default: 'direct' },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.RESERVED,
      index: true,
    },

    // Payment tracking (spec §Payment Information).
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    payments: [paymentEntrySchema],

    // Registration lives inside the booking (spec: no separate module).
    registrationStatus: { type: String, enum: Object.values(REGISTRATION_STATUS), default: REGISTRATION_STATUS.PENDING },
    registrationDate: { type: Date },
    agreementNumber: { type: String, trim: true },
    registrationRemarks: { type: String, trim: true },

    // Full discount breakdown + immutable change history (spec §Discount).
    discount: { type: discountDetailSchema, default: undefined },
    discountHistory: [discountHistorySchema],
    // Pending employee requests (spec §Request Discount / §Request Cancellation).
    discountRequest: { type: discountRequestSchema, default: undefined },
    cancellationRequest: { type: cancellationRequestSchema, default: undefined },

    // Uploaded documents (spec §Documents) + activity timeline (spec §Booking Timeline).
    documents: { type: [bookingDocumentSchema], default: [] },
    timeline: {
      type: [new Schema({ type: { type: String, trim: true }, note: { type: String, trim: true }, at: { type: Date, default: () => new Date() } }, { _id: true })],
      default: [],
    },

    agreementDocuments: [
      {
        label: { type: String, trim: true },
        fileName: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: () => new Date() },
      },
    ],
    paymentMilestones: [paymentMilestoneSchema],

    bookedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelReason: { type: String, trim: true },

    // Booking-transfer history (spec §Booking Transfer). Never deleted.
    transferHistory: [
      {
        at: { type: Date, default: () => new Date() },
        previousExecutive: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        previousExecutiveName: { type: String, trim: true },
        newExecutive: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        newExecutiveName: { type: String, trim: true },
        transferredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        transferredByName: { type: String, trim: true },
        reason: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
)

// One live booking per unit backs double-booking prevention. Reserved, confirmed
// and sale-completed bookings all hold the unit (only cancelled frees it).
bookingSchema.index(
  { unit: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['reserved', 'confirmed', 'sale_completed'] } } }
)

export default model('Booking', bookingSchema)
