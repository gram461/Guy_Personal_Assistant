import { createHash, randomBytes } from 'node:crypto'
import http from 'node:http'
import { GoogleReconnectError, GoogleSignInIncompleteError, GoogleUnavailableError } from './types'

// Google sign-in for an installed app (RFC 8252): the person signs in in their normal browser, Google sends them back to a
// page this app serves on their own computer, and the app trades the one-time code for tokens. Nothing here goes through a server of ours.

export const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/gmail.readonly']
export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

// Google issues these to desktop apps and treats them as non-secret, so shipping them in the app is how Google intends it.
export type GoogleClient = { clientId: string; clientSecret: string }

const b64url = (bytes: Buffer) => bytes.toString('base64url')

export function createPkce() {
  const verifier = b64url(randomBytes(32))
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) }
}

export const newState = () => b64url(randomBytes(16))

export function buildAuthUrl(options: { clientId: string; redirectUri: string; state: string; challenge: string; loginHint?: string }): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state: options.state,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
    // Offline access plus a consent screen every time makes Google return a refresh token.
    access_type: 'offline',
    prompt: 'consent',
  })
  if (options.loginHint) params.set('login_hint', options.loginHint)
  return `${AUTH_URL}?${params}`
}

export type Loopback = {
  redirectUri: string
  // Resolves with the one-time code once Google sends the person back.
  code: Promise<string>
  close: () => void
}

const PAGE = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1>${title}</h1><p>${body}</p></body>`

// Listens on this computer only (127.0.0.1, a free port) for the single request Google sends back after sign-in.
// Anything that doesn't carry the right "state" is turned away, so another page or program can't feed it a code.
export function startLoopback(state: string, timeoutMs: number): Promise<Loopback> {
  return new Promise((resolveStart, rejectStart) => {
    let finish: (result: { code?: string; error?: Error }) => void = () => {}
    const code = new Promise<string>((resolve, reject) => {
      finish = ({ code: value, error }) => (error ? reject(error) : resolve(value as string))
    })
    // The caller awaits `code`, but if the window closes first nobody does; this keeps that from being an unhandled rejection.
    code.catch(() => {})

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (req.method !== 'GET' || url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE('Something is wrong', 'This request did not come from the sign-in that Synergy started. You can close this tab.'))
        return
      }

      const failure = url.searchParams.get('error')
      const received = url.searchParams.get('code')
      if (failure || !received) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE('Not connected', 'Google sign-in was cancelled. You can close this tab and try again in Synergy.'))
        finish({ error: new GoogleSignInIncompleteError('Google sign-in was cancelled') })
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE('You are connected', 'You can close this tab and go back to Synergy.'))
      finish({ code: received })
    })

    const timer = setTimeout(() => finish({ error: new GoogleSignInIncompleteError() }), timeoutMs)
    const close = () => {
      clearTimeout(timer)
      server.close()
      server.closeAllConnections?.()
    }
    code.then(close, close)

    server.once('error', err => rejectStart(err))
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address !== 'object' || address === null) {
        rejectStart(new Error('No port for the Google sign-in'))
        return
      }
      resolveStart({ redirectUri: `http://127.0.0.1:${address.port}/callback`, code, close })
    })
  })
}

export type Tokens = { accessToken: string; refreshToken: string | null; expiresInSeconds: number; email: string | null }

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) })
  } catch (err) {
    throw new GoogleUnavailableError(err instanceof Error ? err.message : 'network error')
  }
}

export function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from((idToken ?? '').split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: unknown }
    return typeof payload.email === 'string' && payload.email.length <= 320 ? payload.email : null
  } catch {
    return null
  }
}

export async function exchangeCode(options: { client: GoogleClient; code: string; verifier: string; redirectUri: string }): Promise<Tokens> {
  const res = await postForm(TOKEN_URL, {
    client_id: options.client.clientId,
    client_secret: options.client.clientSecret,
    code: options.code,
    code_verifier: options.verifier,
    redirect_uri: options.redirectUri,
    grant_type: 'authorization_code',
  })
  if (!res.ok) throw new GoogleUnavailableError(`sign-in request failed (${res.status})`)

  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string }
  if (!json.access_token) throw new GoogleUnavailableError('no access token in the response')
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresInSeconds: json.expires_in ?? 3600,
    email: emailFromIdToken(json.id_token),
  }
}

export async function refreshAccessToken(options: { client: GoogleClient; refreshToken: string }): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const res = await postForm(TOKEN_URL, {
    client_id: options.client.clientId,
    client_secret: options.client.clientSecret,
    refresh_token: options.refreshToken,
    grant_type: 'refresh_token',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    // invalid_grant means the saved sign-in is dead for good (access removed, expired, or the password changed).
    if (body?.error === 'invalid_grant') throw new GoogleReconnectError()
    throw new GoogleUnavailableError(`token request failed (${res.status})`)
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new GoogleUnavailableError('no access token in the response')
  return { accessToken: json.access_token, expiresInSeconds: json.expires_in ?? 3600 }
}

export async function revokeToken(token: string): Promise<void> {
  await postForm(REVOKE_URL, { token })
}
