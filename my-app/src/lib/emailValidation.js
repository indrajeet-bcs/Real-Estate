// Client-side email format, typo detection, and fake/disposable domain blocking
// (mirrors server/src/utils/emailValidator.js for instant form feedback).

const STRICT_EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

const RESERVED_TLDS = new Set([
  'local', 'test', 'invalid', 'example', 'localhost', 'internal', 'lan', 'home', 'localdomain',
])

const BLOCKED_DOMAINS = new Set([
  'localhost', 'example.com', 'example.org', 'example.net',
  'test.com', 'test.org', 'test.net', 'fake.com', 'dummy.com', 'sample.com',
  'none.com', 'null.com', 'nomail.com', 'noemail.com',
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  '10minutemail.com', '10minutemail.net',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'trashmail.com', 'trashmail.net', 'throwawaymail.com',
  'fakeinbox.com', 'getnada.com', 'maildrop.cc', 'dispostable.com',
  'mintemail.com', 'mohmal.com', 'emailondeck.com', 'burnermail.io',
  'mailnesia.com', 'tempr.email', 'discard.email', 'spamgourmet.com',
  'mytemp.email', 'dropmail.me', 'mailcatch.com',
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

export function validateEmailClient(rawEmail, label = 'Email') {
  const email = String(rawEmail || '').trim().toLowerCase()
  if (!email) {
    return { valid: false, email, reason: `${label} is required` }
  }

  const parts = email.split('@')
  if (parts.length !== 2) {
    return { valid: false, email, reason: `${label} must be a valid email address` }
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
    return { valid: false, email, reason: `${label} format is invalid` }
  }

  const labels = domain.split('.')
  const tld = labels[labels.length - 1]
  if (labels.length < 2 || !tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { valid: false, email, reason: `${label} domain "@${domain}" is not valid` }
  }

  if (RESERVED_TLDS.has(tld) || BLOCKED_DOMAINS.has(domain)) {
    return {
      valid: false,
      email,
      reason: `Disposable, test, or placeholder domain "@${domain}" is not allowed. Enter a real email address.`,
    }
  }

  const typoFix = DOMAIN_TYPO_SUGGESTIONS[domain]
  if (typoFix) {
    return {
      valid: false,
      email,
      suggestion: `${localPart}@${typoFix}`,
      reason: `Did you mean "${localPart}@${typoFix}"?`,
    }
  }

  return { valid: true, email, domain }
}
