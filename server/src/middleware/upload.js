import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { ApiError } from '../utils/ApiError.js'

const UPLOAD_DIR = 'uploads'
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Unique, collision-resistant name without Date/random-based module state.
    const ext = path.extname(file.originalname)
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '_')
      .slice(0, 40)
    cb(null, `${base}_${process.hrtime.bigint()}${ext}`)
  },
})

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true)
    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`))
  },
})
