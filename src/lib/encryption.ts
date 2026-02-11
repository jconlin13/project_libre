import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY not set')
  // If key is hex-encoded 32 bytes (64 chars), decode it. Otherwise hash it.
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex')
  }
  return crypto.createHash('sha256').update(key).digest()
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return iv.toString('hex') + ':' + encrypted + ':' + tag.toString('hex')
}

export function decrypt(encryptedText: string): string {
  const key = getKey()
  const parts = encryptedText.split(':')

  if (parts.length !== 3) throw new Error('Invalid encrypted text format')

  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const tag = Buffer.from(parts[2], 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
