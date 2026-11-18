import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleSession, type GoogleSessionDeps } from '../google/session'
import { GoogleNotConfiguredError, GoogleReconnectError, GoogleSignInIncompleteError, GoogleTokenRejectedError, type GoogleLogin } from '../google/types'

const client = { clientId: 'id.apps.googleusercontent.com', clientSecret: 's' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const idToken = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.y`
const realFetch = globalThis.fetch

function setup(overrides: Partial<GoogleSessionDeps> = {}) {
  let saved: GoogleLogin | null = null
  const calls: string[] = []
  const deps: GoogleSessionDeps = {
    client,
    load: async () => saved,
    save: async l => { saved = l },
    clear: async () => { saved = null },
    // Plays the part of the person: opens the sign-in link and lets Google send them back to the app.
    openBrowser: async url => {
      const u = new URL(url)
      calls.push(`open ${u.origin}`)
      void realFetch(`${u.searchParams.get('redirect_uri')}?state=${u.searchParams.get('state')}&code=thecode`)
    },
    signInTimeoutMs: 2000,
    ...overrides,
  }
  return { session: new GoogleSession(deps), get saved() { return saved }, set: (l: GoogleLogin | null) => { saved = l }, calls }
}

const googleFetch = vi.fn()
beforeEach(() => {
  googleFetch.mockReset()
  // Only Google's own addresses are faked; the app's own local callback page is reached for real.
  vi.stubGlobal('fetch', (input: unknown, init?: unknown) => (String(input).startsWith('http://127.0.0.1') ? realFetch(input as string) : googleFetch(input, init)))
})
afterEach(() => vi.unstubAllGlobals())

describe('GoogleSession', () => {
  it('starts not connected, and says whether this build can sign in at all', async () => {
    expect(await setup().session.status()).toEqual({ configured: true, connected: false, email: null })
    expect(await setup({ client: null }).session.status()).toEqual({ configured: false, connected: false, email: null })
  })

  it('signs in through the browser and saves only the long-lived token and the email', async () => {
    const t = setup()
    googleFetch.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, id_token: idToken('me@school.example') }))
    expect(await t.session.connect()).toEqual({ configured: true, connected: true, email: 'me@school.example' })
    expect(t.saved).toEqual({ refreshToken: 'rt', email: 'me@school.example' })
    expect(t.calls).toEqual(['open https://accounts.google.com'])
    expect(String(googleFetch.mock.calls[0][1].body)).toContain('code=thecode')
  })

  it('refuses to sign in when this build has no Google client', async () => {
    await expect(setup({ client: null }).session.connect()).rejects.toThrow(GoogleNotConfiguredError)
  })

  it('reports a sign-in that is never finished', async () => {
    const t = setup({ openBrowser: async () => {}, signInTimeoutMs: 50 })
    await expect(t.session.connect()).rejects.toThrow(GoogleSignInIncompleteError)
    expect(t.saved).toBeNull()
  })

  it('reports Google not handing back a saved sign-in, and saves nothing', async () => {
    const t = setup()
    googleFetch.mockResolvedValue(json({ access_token: 'at', expires_in: 3600 }))
    await expect(t.session.connect()).rejects.toThrow('did not return a saved sign-in')
    expect(t.saved).toBeNull()
  })

  it('reuses an access token until it is nearly expired', async () => {
    const t = setup()
    t.set({ refreshToken: 'rt', email: 'e' })
    googleFetch.mockImplementation(async () => json({ access_token: 'at', expires_in: 3600 }))
    const run = vi.fn(async (token: string) => token)
    expect(await t.session.withAccess(run)).toBe('at')
    expect(await t.session.withAccess(run)).toBe('at')
    expect(googleFetch).toHaveBeenCalledTimes(1)
  })

  it('asks to reconnect when never connected, without calling Google', async () => {
    await expect(setup().session.withAccess(async () => 1)).rejects.toThrow(GoogleReconnectError)
    expect(googleFetch).not.toHaveBeenCalled()
  })

  it('forgets a sign-in Google says is dead', async () => {
    const t = setup()
    t.set({ refreshToken: 'dead', email: 'e' })
    googleFetch.mockResolvedValue(json({ error: 'invalid_grant' }, 400))
    await expect(t.session.withAccess(async () => 1)).rejects.toThrow(GoogleReconnectError)
    expect(t.saved).toBeNull()
    expect((await t.session.status()).connected).toBe(false)
  })

  it('tries once more with a fresh token when Google rejects the one it used, then asks to reconnect', async () => {
    const t = setup()
    t.set({ refreshToken: 'rt', email: 'e' })
    let n = 0
    googleFetch.mockImplementation(async () => json({ access_token: `at${++n}`, expires_in: 3600 }))
    const used: string[] = []
    expect(await t.session.withAccess(async token => { used.push(token); if (token === 'at1') throw new GoogleTokenRejectedError(); return 'ok' })).toBe('ok')
    expect(used).toEqual(['at1', 'at2'])

    await expect(t.session.withAccess(async () => { throw new GoogleTokenRejectedError() })).rejects.toThrow(GoogleReconnectError)
  })

  it('passes other errors through without retrying', async () => {
    const t = setup()
    t.set({ refreshToken: 'rt', email: 'e' })
    googleFetch.mockImplementation(async () => json({ access_token: 'at', expires_in: 3600 }))
    const run = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(t.session.withAccess(run)).rejects.toThrow('boom')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('signs out: revokes at Google and forgets the sign-in, even when Google is unreachable', async () => {
    const t = setup()
    t.set({ refreshToken: 'rt', email: 'e' })
    googleFetch.mockRejectedValue(new Error('offline'))
    await t.session.disconnect()
    expect(t.saved).toBeNull()
    expect(String(googleFetch.mock.calls[0][0])).toBe('https://oauth2.googleapis.com/revoke')
  })

  it('does not start two sign-ins at once', async () => {
    const t = setup()
    googleFetch.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }))
    const [a, b] = await Promise.all([t.session.connect(), t.session.connect()])
    expect(a).toEqual(b)
    expect(t.calls).toHaveLength(1)
  })
})
