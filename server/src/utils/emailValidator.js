import dns from 'dns/promises'
import { ApiError } from './ApiError.js'

const STRICT_EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

const RESERVED_TLDS = new Set([
  'local',
  'test',
  'invalid',
  'example',
  'localhost',
  'internal',
  'lan',
  'home',
  'localdomain',
])

const BLOCKED_DOMAINS = new Set([
  'localhost',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'test.net',
  'fake.com',
  'dummy.com',
  'sample.com',
  'none.com',
  'null.com',
  'nomail.com',
  'noemail.com',
  // Common disposable / temporary inbox domains
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'throwawaymail.com',
  'fakeinbox.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'mintemail.com',
  'mohmal.com',
  'emailondeck.com',
  'burnermail.io',
  'mailnesia.com',
  'tempr.email',
  'discard.email',
  'spamgourmet.com',
  'mytemp.email',
  'dropmail.me',
  'mailcatch.com',
])

const DOMAIN_TYPO_SUGGESTIONS = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yaoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'homail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'protonmal.com': 'protonmail.com',
  'protomail.com': 'protonmail.com',
}

// In-memory DNS MX verification cache (15 minutes TTL)
const mxCache = new Map()
const MX_CACHE_TTL_MS = 15 * 60 * 1000
const DNS_TIMEOUT_MS = 4500

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase()
}

/**
 * Synchronous checks: strict syntax, length limits, reserved TLDs,
 * disposable providers, and common provider typos.
 */
export function validateEmailSyntaxAndDomain(rawEmail, label = 'Email') {
  const email = normalizeEmail(rawEmail)
  if (!email) {
    return { valid: false, email, code: 'EMPTY', reason: `${label} is required` }
  }

  const parts = email.split('@')
  if (parts.length !== 2) {
    return { valid: false, email, code: 'FORMAT', reason: `${label} must be a valid email address` }
  }

  const [localPart, domain] = parts
  if (
    !localPart ||
    !domain ||
    localPart.length > 64 ||
    domain.length > 253 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    domain.includes('..') ||
    !STRICT_EMAIL_REGEX.test(email)
  ) {
    return { valid: false, email, code: 'FORMAT', reason: `${label} format is invalid` }
  }

  const domainLabels = domain.split('.')
  const tld = domainLabels[domainLabels.length - 1]
  if (domainLabels.length < 2 || !tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { valid: false, email, code: 'INVALID_DOMAIN', reason: `${label} domain "@${domain}" is not valid` }
  }

  if (RESERVED_TLDS.has(tld) || BLOCKED_DOMAINS.has(domain)) {
    return {
      valid: false,
      email,
      code: 'DISPOSABLE_OR_FAKE',
      reason: `Disposable, test, or placeholder email domain "@${domain}" is not allowed. Please enter a real email address.`,
    }
  }

  const typoFix = DOMAIN_TYPO_SUGGESTIONS[domain]
  if (typoFix) {
    return {
      valid: false,
      email,
      code: 'TYPO',
      suggestion: `${localPart}@${typoFix}`,
      reason: `Domain "@${domain}" looks like a typo. Did you mean "${localPart}@${typoFix}"?`,
    }
  }

  return { valid: true, email, domain }
}

async function lookupMxWithTimeout(domain) {
  let timer = null
  try {
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('DNS MX lookup timed out')
          err.code = 'ETIMEOUT'
          reject(err)
        }, DNS_TIMEOUT_MS)
      }),
    ])
    const activeRecords = Array.isArray(mxRecords)
      ? mxRecords.filter((r) => r && r.exchange && r.exchange.trim() !== '' && r.exchange.trim() !== '.')
      : []
    return { ok: activeRecords.length > 0, count: activeRecords.length }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Full real-email check: syntax/domain hygiene + DNS MX record lookup.
 * Ensures the domain actually hosts a mail server capable of receiving email.
 */
export async function verifyRealEmail(rawEmail, { label = 'Email' } = {}) {
  const basic = validateEmailSyntaxAndDomain(rawEmail, label)
  if (!basic.valid) return basic

  const { email, domain } = basic

  // Check cache first
  const cached = mxCache.get(domain)
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.valid) {
      return {
        valid: false,
        email,
        code: 'NO_MX',
        reason: `Domain "@${domain}" cannot receive emails (no active mail server / MX records found). Please enter a real email address.`,
      }
    }
    return { valid: true, email, domain, cached: true }
  }

  try {
    const res = await lookupMxWithTimeout(domain)
    if (!res.ok) {
      mxCache.set(domain, { valid: false, expiresAt: Date.now() + MX_CACHE_TTL_MS })
      return {
        valid: false,
        email,
        code: 'NO_MX',
        reason: `Domain "@${domain}" has no mail server (MX records). Please enter a valid deliverable email address.`,
      }
    }

    mxCache.set(domain, { valid: true, expiresAt: Date.now() + MX_CACHE_TTL_MS })
    return { valid: true, email, domain }
  } catch (err) {
    // Definitive "domain does not exist" / "no MX records" errors
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'ESERVFAIL') {
      mxCache.set(domain, { valid: false, expiresAt: Date.now() + MX_CACHE_TTL_MS })
      return {
        valid: false,
        email,
        code: 'NO_MX',
        reason: `Email domain "@${domain}" does not exist or cannot receive emails. Please provide a real email address.`,
      }
    }

    // Transient DNS timeout / offline environment — report clearly instead of caching a false negative
    return {
      valid: false,
      email,
      code: 'DNS_TIMEOUT',
      reason: `Could not verify mail server for "@${domain}" (${err.code || 'DNS lookup failed'}). Check domain spelling or network connection.`,
    }
  }
}

/**
 * Asserts an email is real and deliverable, throwing ApiError.badRequest on failure.
 * Returns normalized lowercase email string on success.
 */
export async function assertRealEmail(rawEmail, opts = {}) {
  const result = await verifyRealEmail(rawEmail, opts)
  if (!result.valid) {
    throw ApiError.badRequest(result.reason)
  }
  return result.email
}
