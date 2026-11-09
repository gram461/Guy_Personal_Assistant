import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { DataUnreadableError } from './errors'

const MAGIC = Buffer.from('GSV1')
const IV_BYTES = 12
const TAG_BYTES = 16
// Ties the ciphertext to one kind of file, so a file of another kind can't be swapped in.
export const GRADES_CONTEXT = 'guy-scraper:grades:v1'
export const EDITS_CONTEXT = 'guy-scraper:edits:v1'

function checkKey(key: Buffer) {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes')
}

// File layout: "GSV1" | 12-byte IV | 16-byte tag | ciphertext (AES-256-GCM).
export function encryptBytes(plain: string | Buffer, key: Buffer, context = GRADES_CONTEXT): Buffer {
  checkKey(key)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(context))
  const data = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), data])
}

export function decryptBytes(blob: Buffer, key: Buffer, context = GRADES_CONTEXT): Buffer {
  checkKey(key)
  const headerLength = MAGIC.length + IV_BYTES + TAG_BYTES
  if (blob.length < headerLength || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new DataUnreadableError('The grades file is not in the expected format')
  }

  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_BYTES)
  const tag = blob.subarray(MAGIC.length + IV_BYTES, headerLength)
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from(context))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(blob.subarray(headerLength)), decipher.final()])
  } catch {
    throw new DataUnreadableError('The grades file could not be decrypted: it was changed, or its key is different')
  }
}
