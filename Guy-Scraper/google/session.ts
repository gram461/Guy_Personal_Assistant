import { emailFromIdToken, buildAuthUrl, createPkce, exchangeCode, newState, refreshAccessToken, revokeToken, startLoopback, type GoogleClient } from './oauth'
import {
  GoogleNotConfiguredError, GoogleReconnectError, GoogleTokenRejectedError, GoogleUnavailableError,
  type GoogleLogin, type GoogleStatus,
} from './types'

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const EARLY_MS = 2 * 60 * 1000

export type GoogleSessionDeps = {
  // Null when this build has no Google client ID.
  client: GoogleClient | null
  load: () => Promise<GoogleLogin | null>
  save: (login: GoogleLogin) => Promise<void>
  clear: () => Promise<void>
  // Opens the Google sign-in page in the person's normal browser.
  openBrowser: (url: string) => Promise<void>
  signInTimeoutMs?: number
}

// Everything the app needs from Google's side: sign in, stay signed in, hand out short-lived access tokens, sign out.
// The long-lived token is saved (encrypted) by the caller; the short-lived ones live only in memory.
export class GoogleSession {
  private cached: { token: string; expiresAt: number } | null = null
  private connecting: Promise<GoogleStatus> | null = null

  constructor(private readonly deps: GoogleSessionDeps) {}

  async status(): Promise<GoogleStatus> {
    const login = await this.deps.load()
    return { configured: this.deps.client !== null, connected: login !== null, email: login?.email || null }
  }

  // Opens the browser, waits for the person to sign in, saves the sign-in. A second call while one is running joins it.
  connect(): Promise<GoogleStatus> {
    this.connecting ??= this.runConnect().finally(() => {
      this.connecting = null
    })
    return this.connecting
  }

  private async runConnect(): Promise<GoogleStatus> {
    const client = this.deps.client
    if (!client) throw new GoogleNotConfiguredError()

    const state = newState()
    const { verifier, challenge } = createPkce()
    const loopback = await startLoopback(state, this.deps.signInTimeoutMs ?? SIGN_IN_TIMEOUT_MS)
    try {
      await this.deps.openBrowser(buildAuthUrl({ clientId: client.clientId, redirectUri: loopback.redirectUri, state, challenge }))
      const code = await loopback.code
      const tokens = await exchangeCode({ client, code, verifier, redirectUri: loopback.redirectUri })
      if (!tokens.refreshToken) throw new GoogleUnavailableError('Google did not return a saved sign-in')

      await this.deps.save({ refreshToken: tokens.refreshToken, email: tokens.email ?? '' })
      this.cached = { token: tokens.accessToken, expiresAt: Date.now() + tokens.expiresInSeconds * 1000 }
      return await this.status()
    } finally {
      loopback.close()
    }
  }

  // Signs out: tells Google to drop the access, then forgets the saved sign-in. Works even when Google can't be reached.
  async disconnect(): Promise<void> {
    const login = await this.deps.load().catch(() => null)
    this.cached = null
    if (login) await revokeToken(login.refreshToken).catch(() => undefined)
    await this.deps.clear()
  }

  private async accessToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt - EARLY_MS) return this.cached.token
    const client = this.deps.client
    if (!client) throw new GoogleNotConfiguredError()

    const login = await this.deps.load()
    if (!login) throw new GoogleReconnectError()

    try {
      const fresh = await refreshAccessToken({ client, refreshToken: login.refreshToken })
      this.cached = { token: fresh.accessToken, expiresAt: Date.now() + fresh.expiresInSeconds * 1000 }
      return fresh.accessToken
    } catch (err) {
      // A sign-in Google says is dead is forgotten, so the app asks to connect again instead of failing quietly every time.
      if (err instanceof GoogleReconnectError) {
        this.cached = null
        await this.deps.clear()
      }
      throw err
    }
  }

  // Runs a Google call. If Google rejects the token it was given, one more try is made with a fresh one;
  // rejected again means the person needs to sign in again.
  async withAccess<T>(run: (accessToken: string) => Promise<T>): Promise<T> {
    try {
      return await run(await this.accessToken())
    } catch (err) {
      if (!(err instanceof GoogleTokenRejectedError)) throw err
    }

    this.cached = null
    try {
      return await run(await this.accessToken())
    } catch (err) {
      if (err instanceof GoogleTokenRejectedError) throw new GoogleReconnectError()
      throw err
    }
  }
}

export { emailFromIdToken }
