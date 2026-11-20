import { afterEach, describe, expect, it, vi } from 'vitest'
import { isInstalledApp, isIosDevice } from '../desktop/ui/bridge'

const setBrowser = (win: object, nav: object) => {
  vi.stubGlobal('window', win)
  vi.stubGlobal('navigator', nav)
}
const media = (matching: string[]) => ({ matchMedia: (query: string) => ({ matches: matching.some(mode => query === `(display-mode: ${mode})`) }) })

afterEach(() => vi.unstubAllGlobals())

describe('isInstalledApp', () => {
  it('is true when the site was opened from the home screen, however the browser reports it', () => {
    for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
      setBrowser(media([mode]), {})
      expect(isInstalledApp()).toBe(true)
    }
    setBrowser({ matchMedia: () => ({ matches: false }) }, { standalone: true }) // Safari's own way of saying it
    expect(isInstalledApp()).toBe(true)
  })

  it('is false in a normal browser tab, and when the browser cannot say', () => {
    setBrowser(media(['browser']), {})
    expect(isInstalledApp()).toBe(false)
    setBrowser(media([]), { standalone: false })
    expect(isInstalledApp()).toBe(false)
    setBrowser({}, {}) // no matchMedia at all
    expect(isInstalledApp()).toBe(false)
  })
})

describe('isIosDevice', () => {
  it('spots iPhones and iPads, including iPads that present as Macs', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 })
    expect(isIosDevice()).toBe(true)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 5 })
    expect(isIosDevice()).toBe(true)
  })

  it('is false on Android and on real Macs', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l', maxTouchPoints: 5 })
    expect(isIosDevice()).toBe(false)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0 })
    expect(isIosDevice()).toBe(false)
  })
})
