/**
 * @jest-environment node
 */

// Set encryption key before importing
process.env.ENCRYPTION_KEY = 'a'.repeat(64)

import { encrypt, decrypt } from '@/lib/encryption'

describe('Encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const original = 'my-secret-api-token-12345'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toContain(':')

    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should produce different ciphertexts for same input', () => {
    const original = 'same-input'
    const encrypted1 = encrypt(original)
    const encrypted2 = encrypt(original)
    expect(encrypted1).not.toBe(encrypted2)

    expect(decrypt(encrypted1)).toBe(original)
    expect(decrypt(encrypted2)).toBe(original)
  })

  it('should handle empty strings', () => {
    const encrypted = encrypt('')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('should handle special characters', () => {
    const original = 'token with spaces & special chars! @#$%^&*()'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should handle long strings', () => {
    const original = 'x'.repeat(10000)
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should throw on invalid encrypted format', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format')
  })

  it('should throw on tampered ciphertext', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    parts[1] = 'ff' + parts[1].slice(2)
    expect(() => decrypt(parts.join(':'))).toThrow()
  })
})
