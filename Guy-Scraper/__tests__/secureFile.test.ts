import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { DataUnreadableError } from '../errors'
import { EDITS_CONTEXT, decryptBytes, encryptBytes } from '../secureFile'

const key = () => randomBytes(32)

describe('encryptBytes / decryptBytes', () => {
  it('round-trips text', () => {
    const k = key()
    expect(decryptBytes(encryptBytes('type\tclass\nclass\tBiology\n', k), k).toString('utf8')).toBe('type\tclass\nclass\tBiology\n')
  })

  it('does not leave the text readable in the file', () => {
    const blob = encryptBytes('Biology grades for SmithJ', key())
    expect(blob.toString('latin1')).not.toContain('Biology')
    expect(blob.subarray(0, 4).toString()).toBe('GSV1')
  })

  it('encrypts the same text differently each time', () => {
    const k = key()
    expect(encryptBytes('same', k).equals(encryptBytes('same', k))).toBe(false)
  })

  it('refuses the wrong key', () => {
    const blob = encryptBytes('secret', key())
    expect(() => decryptBytes(blob, key())).toThrow(DataUnreadableError)
  })

  it('refuses a file that was changed, anywhere in it', () => {
    const k = key()
    const blob = encryptBytes('secret grades', k)
    for (const position of [0, 5, 20, blob.length - 1]) {
      const changed = Buffer.from(blob)
      changed[position] ^= 1
      expect(() => decryptBytes(changed, k)).toThrow(DataUnreadableError)
    }
  })

  it('refuses files that are too short or not ours', () => {
    const k = key()
    expect(() => decryptBytes(Buffer.alloc(0), k)).toThrow(DataUnreadableError)
    expect(() => decryptBytes(Buffer.from('not an encrypted grades file at all, just text'), k)).toThrow(DataUnreadableError)
  })

  it('refuses a file made for a different purpose, even with the right key', () => {
    const k = key()
    const blob = encryptBytes('secret', k, EDITS_CONTEXT)
    expect(decryptBytes(blob, k, EDITS_CONTEXT).toString()).toBe('secret')
    expect(() => decryptBytes(blob, k)).toThrow(DataUnreadableError)
    expect(() => decryptBytes(encryptBytes('secret', k), k, EDITS_CONTEXT)).toThrow(DataUnreadableError)
  })

  it('refuses keys of the wrong size', () => {
    expect(() => encryptBytes('x', Buffer.alloc(16))).toThrow('32 bytes')
    expect(() => decryptBytes(encryptBytes('x', key()), Buffer.alloc(16))).toThrow('32 bytes')
  })
})
