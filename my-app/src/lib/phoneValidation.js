export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/

/**
 * Extracts up to 10 digits for pre-filling an existing DB phone/mobile value
 * into a +91 10-digit input field without breaking existing data.
 */
export function extractIndianMobile(val) {
  if (val === undefined || val === null) return ''
  let digits = String(val).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  return digits.slice(0, 10)
}

/**
 * Sanitizes live input to digits only (max 10 digits after +91).
 */
export function sanitizeMobileInput(val) {
  return String(val || '').replace(/\D/g, '').slice(0, 10)
}

/**
 * Validates a 10-digit Indian mobile number (after +91).
 * Returns an error string if invalid, or '' if valid.
 */
export function validateIndianMobile(val, { required = false, label = 'Mobile number' } = {}) {
  const raw = val === undefined || val === null ? '' : String(val)
  if (!raw) {
    return required ? `${label} is required` : ''
  }
  if (/[^0-9]/.test(raw)) {
    return `${label} must contain digits only after +91`
  }
  if (raw.length !== 10) {
    return `${label} must be exactly 10 digits after +91 (${raw.length}/10)`
  }
  if (!/^[6-9]/.test(raw)) {
    return `${label} must start with 6, 7, 8, or 9`
  }
  return ''
}

/**
 * Strict parser for Excel/CSV imports.
 * Accepts 10 digits starting with 6-9, or +91 followed by 10 digits starting with 6-9.
 * Rejects spaces, alphabets, special characters, and invalid lengths.
 */
export function parseExcelIndianMobile(val) {
  if (val === undefined || val === null || val === '') {
    return { valid: false, mobile: '', error: 'Mobile number is required' }
  }
  const str = String(val)
  const withoutCc = str.startsWith('+91') ? str.slice(3) : str

  if (/[^0-9]/.test(withoutCc)) {
    return {
      valid: false,
      mobile: '',
      error: 'Mobile must contain digits only after +91 (no spaces, alphabets, or special characters)',
    }
  }
  if (withoutCc.length !== 10) {
    return {
      valid: false,
      mobile: '',
      error: `Mobile must be exactly 10 digits after +91 (${withoutCc.length}/10)`,
    }
  }
  if (!/^[6-9]/.test(withoutCc)) {
    return {
      valid: false,
      mobile: '',
      error: 'Mobile must start with 6, 7, 8, or 9',
    }
  }
  return { valid: true, mobile: withoutCc, error: '' }
}
