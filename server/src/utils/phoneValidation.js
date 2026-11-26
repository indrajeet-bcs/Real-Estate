import { z } from 'zod'

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/
export const INDIAN_MOBILE_WITH_CC_REGEX = /^(\+91)?[6-9]\d{9}$/

/**
 * Validates and normalizes an Indian mobile number.
 * Accepts either 10 digits (e.g. "9876543210") or "+91" followed by 10 digits ("+919876543210").
 * Rejects spaces, alphabets, special characters, and invalid lengths.
 */
export function parseIndianMobile(val) {
  if (val === undefined || val === null || val === '') {
    return { valid: false, error: 'Mobile number is required' }
  }
  const str = String(val)
  const withoutCc = str.startsWith('+91') ? str.slice(3) : str

  if (/[^0-9]/.test(withoutCc)) {
    return {
      valid: false,
      error: 'Mobile number must contain digits only after +91 (no spaces, alphabets, or special characters)',
    }
  }
  if (withoutCc.length !== 10) {
    return {
      valid: false,
      error: `Mobile number must be exactly 10 digits after +91 (got ${withoutCc.length})`,
    }
  }
  if (!/^[6-9]/.test(withoutCc)) {
    return {
      valid: false,
      error: 'Indian mobile number must start with 6, 7, 8, or 9',
    }
  }
  return { valid: true, mobile: withoutCc }
}

/**
 * Zod schema for a required Indian mobile number.
 */
export const requiredIndianMobileSchema = z
  .union([z.string(), z.number()])
  .transform((val) => String(val))
  .superRefine((val, ctx) => {
    const res = parseIndianMobile(val)
    if (!res.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error })
    }
  })
  .transform((val) => {
    const res = parseIndianMobile(val)
    return res.valid ? res.mobile : val
  })

/**
 * Zod schema for an optional Indian mobile number (empty string / null / undefined allowed).
 */
export const optionalIndianMobileSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((val) => (val === '' || val === null || val === undefined ? undefined : String(val)))
  .superRefine((val, ctx) => {
    if (val === undefined) return
    const res = parseIndianMobile(val)
    if (!res.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error })
    }
  })
  .transform((val) => {
    if (val === undefined) return undefined
    const res = parseIndianMobile(val)
    return res.valid ? res.mobile : val
  })
