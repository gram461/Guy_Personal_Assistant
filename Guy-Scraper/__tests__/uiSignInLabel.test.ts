import { afterEach, describe, expect, it, vi } from 'vitest'
import { signInLabel } from '../desktop/ui/parts'

const withBridge = (platform?: 'desktop' | 'web' | 'app') => vi.stubGlobal('window', { synergy: { platform } })

afterEach(() => vi.unstubAllGlobals())

describe('signInLabel', () => {
  it('offers sign-in through the app when running in the phone shell', () => {
    withBridge('app')
    expect(signInLabel()).toBe('Sign into Schoology through the app')
  })

  it('keeps the plain wording on the desktop app', () => {
    withBridge()
    expect(signInLabel()).toBe('Sign in to Schoology')
    withBridge('desktop')
    expect(signInLabel()).toBe('Sign in to Schoology')
  })
})
