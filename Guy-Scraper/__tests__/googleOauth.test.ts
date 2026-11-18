import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCOPES, buildAuthUrl, createPkce, emailFromIdToken, exchangeCode, newState, refreshAccessToken, revokeToken, startLoopback } from '../google/oauth'
import { GoogleReconnectError, GoogleSignInIncompleteError, GoogleUnavailableError } from '../google/types'

const client = { clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const idToken = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`

afterEach(() => vi.unstubAllGlobals())

describe('PKCE and the sign-in link', () => {
  it('makes a challenge that is the SHA-256 of the verifier', () => {
    const { verifier, challenge } = createPkce()
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(createPkce().verifier).not.toBe(verifier)
    expect(newState()).not.toBe(newState())
  })

  it('asks for read-only access, offline, with the challenge and state', () => {
    const url = new URL(buildAuthUrl({ clientId: client.clientId, redirectUri: 'http://127.0.0.1:5555/callback', state: 'st', challenge: 'ch' }))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    const p = url.searchParams
    expect(p.get('client_id')).toBe(client.clientId)
    expect(p.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback')
    expect(p.get('response_type')).toBe('code')
    expect(p.get('state')).toBe('st')
    expect(p.get('code_challenge')).toBe('ch')
    expect(p.get('code_challenge_method')).toBe('S256')
    expect(p.get('access_type')).toBe('offline')
    expect(p.get('scope')?.split(' ')).toEqual(SCOPES)
    for (const scope of SCOPES.slice(2)) expect(scope).toMatch(/readonly$/)
  })
})

describe('startLoopback', () => {
  const callback = (redirectUri: string, query: string) => fetch(`${redirectUri}?${query}`)

  it('listens on this computer only and hands back the code', async () => {
    const loop = await startLoopback('st', 5000)
    expect(loop.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    const res = await callback(loop.redirectUri, 'state=st&code=abc')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('You are connected')
    expect(await loop.code).toBe('abc')
  })

  it('turns away a request with the wrong state and keeps waiting', async () => {
    const loop = await startLoopback('st', 5000)
    const bad = await callback(loop.redirectUri, 'state=evil&code=stolen')
    expect(bad.status).toBe(400)
    const other = await fetch(loop.redirectUri.replace('/callback', '/other'))
    expect(other.status).toBe(404)
    await callback(loop.redirectUri, 'state=st&code=real')
    expect(await loop.code).toBe('real')
  })

  it('reports a cancelled sign-in', async () => {
    const loop = await startLoopback('st', 5000)
    const pending = expect(loop.code).rejects.toThrow(GoogleSignInIncompleteError)
    await callback(loop.redirectUri, 'state=st&error=access_denied')
    await pending
  })

  it('gives up after the time limit', async () => {
    const loop = await startLoopback('st', 30)
    await expect(loop.code).rejects.toThrow(GoogleSignInIncompleteError)
  })

  it('stops listening once finished', async () => {
    const loop = await startLoopback('st', 5000)
    await callback(loop.redirectUri, 'state=st&code=abc')
    await loop.code
    await new Promise(r => setTimeout(r, 20))
    await expect(callback(loop.redirectUri, 'state=st&code=again')).rejects.toThrow()
  })
})

describe('tokens', () => {
  it('reads the email from the id token', () => {
    expect(emailFromIdToken(idToken({ email: 'a@b.example' }))).toBe('a@b.example')
    expect(emailFromIdToken(idToken({ sub: '1' }))).toBeNull()
    expect(emailFromIdToken('garbage')).toBeNull()
    expect(emailFromIdToken(undefined)).toBeNull()
  })

  it('trades the code for tokens, sending the verifier and no password anywhere', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3599, id_token: idToken({ email: 'me@school.example' }) }))
    vi.stubGlobal('fetch', fetchMock)
    const tokens = await exchangeCode({ client, code: 'abc', verifier: 'ver', redirectUri: 'http://127.0.0.1:1/callback' })
    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresInSeconds: 3599, email: 'me@school.example' })
    const body = String(fetchMock.mock.calls[0][1].body)
    expect(body).toContain('grant_type=authorization_code')
    expect(body).toContain('code_verifier=ver')
  })

  it('reports Google failing the code exchange', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'invalid_grant' }, 400)))
    await expect(exchangeCode({ client, code: 'abc', verifier: 'v', redirectUri: 'r' })).rejects.toThrow(GoogleUnavailableError)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(exchangeCode({ client, code: 'abc', verifier: 'v', redirectUri: 'r' })).rejects.toThrow(GoogleUnavailableError)
  })

  it('refreshes an access token, and says reconnect when the saved sign-in is dead', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ access_token: 'new', expires_in: 3600 })))
    expect(await refreshAccessToken({ client, refreshToken: 'rt' })).toEqual({ accessToken: 'new', expiresInSeconds: 3600 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'invalid_grant' }, 400)))
    await expect(refreshAccessToken({ client, refreshToken: 'rt' })).rejects.toThrow(GoogleReconnectError)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'backend_error' }, 503)))
    await expect(refreshAccessToken({ client, refreshToken: 'rt' })).rejects.toThrow(GoogleUnavailableError)
  })

  it('revokes a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}))
    vi.stubGlobal('fetch', fetchMock)
    await revokeToken('rt')
    expect(fetchMock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/revoke')
    expect(String(fetchMock.mock.calls[0][1].body)).toBe('token=rt')
  })
})
