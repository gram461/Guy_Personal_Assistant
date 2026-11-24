import { describe, expect, it, vi } from 'vitest'
import { openShareSheet, readDismissedAt, rememberDismissed, shouldOfferInstall } from '@/components/synergy/installLogic'

const DAY = 24 * 60 * 60 * 1000
const base = { ios: true, installed: false, phoneApp: false, dismissedAt: null, now: 100 * DAY }

describe('shouldOfferInstall', () => {
  it('offers the install sheet in Safari on an iPhone or iPad', () => {
    expect(shouldOfferInstall(base)).toBe(true)
  })

  it('stays away from other devices, the installed app and the phone shell', () => {
    expect(shouldOfferInstall({ ...base, ios: false })).toBe(false)
    expect(shouldOfferInstall({ ...base, installed: true })).toBe(false)
    expect(shouldOfferInstall({ ...base, phoneApp: true })).toBe(false)
  })

  it('stays quiet for two weeks after "Not now", then asks again', () => {
    expect(shouldOfferInstall({ ...base, dismissedAt: base.now - 13 * DAY })).toBe(false)
    expect(shouldOfferInstall({ ...base, dismissedAt: base.now - 15 * DAY })).toBe(true)
  })
})

describe('remembering "Not now"', () => {
  it('saves and reads the time back', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    expect(readDismissedAt(storage)).toBeNull()
    rememberDismissed(storage, 1234)
    expect(readDismissedAt(storage)).toBe(1234)
  })

  it('copes with storage that refuses', () => {
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readDismissedAt(broken)).toBeNull()
    expect(() => rememberDismissed(broken, 1)).not.toThrow()
    expect(readDismissedAt(undefined)).toBeNull()
  })
})

describe('openShareSheet', () => {
  it('opens the share sheet for the page', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(await openShareSheet({ share }, 'https://x.test/app')).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Synergy', url: 'https://x.test/app' })
  })

  it('tells a closed sheet apart from a browser with no share menu', async () => {
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' })
    expect(await openShareSheet({ share: () => Promise.reject(abort) }, 'u')).toBe('cancelled')
    expect(await openShareSheet({ share: () => Promise.reject(new Error('nope')) }, 'u')).toBe('unavailable')
    expect(await openShareSheet({}, 'u')).toBe('unavailable')
  })
})
