import mongoose from 'mongoose'

const { Schema, model } = mongoose

// Tracks a bulk lead import (§5): the uploaded file, column mapping, and the
// validation-engine outcome split into successful / duplicate / failed rows.
const importBatchSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    fileName: { type: String },
    columnMapping: { type: Schema.Types.Mixed }, // { csvColumn: customerField }

    totalRows: { type: Number, default: 0 },
    successfulCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },

    // Rejected rows retained for review/download.
    duplicateRows: [{ type: Schema.Types.Mixed }],
    failedRows: [{ type: Schema.Types.Mixed }], // { row, reason }

    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    importedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default model('ImportBatch', importBatchSchema)
