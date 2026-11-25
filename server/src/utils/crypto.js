import crypto from 'crypto'
import { env } from '../config/env.js'

/**
 * Returns a 32-byte Buffer key for AES-256-GCM encryption.
 */
function getEncryptionKey() {
  const rawKey = env.smtpEncryptionKey || process.env.SMTP_ENCRYPTION_KEY || '15f232881a5f79b410a419d41a0b08b31fb12dcbbc159bd8ca6826ee157c98c6'
  // If provided as a 64-character hex string, parse directly into 32 bytes
  if (typeof rawKey === 'string' && rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }
  // Otherwise, run SHA-256 over the string to consistently produce a 32-byte key
  return crypto.createHash('sha256').update(String(rawKey)).digest()
}

/**
 * Encrypts plain text using AES-256-GCM authenticated encryption.
 * @param {string} plainText
 * @returns {string} Serialized format: "iv:authTag:cipherText" in hex
 */
export function encryptSmtpPassword(plainText) {
  if (!plainText || typeof plainText !== 'string') return ''
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // Standard 12-byte IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts AES-256-GCM encrypted text.
 * @param {string} encryptedText Format: "iv:authTag:cipherText"
 * @returns {string} Decrypted plain text
 */
export function decryptSmtpPassword(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return ''
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format for SMTP password')
  }

  const [ivHex, authTagHex, cipherHex] = parts
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
