import { supabaseServer } from './supabaseServer'
import { encryptSecret, decryptSecret } from './tokenCrypto'

const encryptionContext = (userId: string) => `google_refresh_token:${userId}`

// The person has to sign in with Google again: they never connected, they revoked access, or Google no longer accepts the saved sign-in.
export class GoogleReconnectError extends Error {
  constructor() {
    super('Google needs to be reconnected')
    this.name = 'GoogleReconnectError'
  }
}

// Google answered with an error that isn't about this person's sign-in (it is down, slow, or rejected the request).
export class GoogleUnavailableError extends Error {
  constructor(detail: string) {
    super(`Google is unavailable: ${detail}`)
    this.name = 'GoogleUnavailableError'
  }
}

// Access tokens live only in this server's memory, never in the browser or the database.
// A server that restarts just fetches a new one.
const CACHE_LIMIT = 500
const EARLY_MS = 2 * 60 * 1000
const cache = new Map<string, { token: string; expiresAt: number }>()

export function forgetGoogleAccessToken(userId: string) {
  cache.delete(userId)
}

export async function saveGoogleRefreshToken(userId: string, refreshToken: string) {
  const { error } = await supabaseServer.from('google_tokens').upsert({
    user_id: userId,
    refresh_token_encrypted: encryptSecret(refreshToken, encryptionContext(userId)),
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Failed to save Google token: ${error.message}`)
  forgetGoogleAccessToken(userId)
}

async function loadGoogleRefreshToken(userId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from('google_tokens')
    .select('refresh_token_encrypted')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data?.refresh_token_encrypted) return null
  return decryptSecret(data.refresh_token_encrypted, encryptionContext(userId))
}

async function deleteGoogleRefreshToken(userId: string) {
  await supabaseServer.from('google_tokens').delete().eq('user_id', userId)
  forgetGoogleAccessToken(userId)
}

// A short-lived Google access token for this person, from their saved sign-in.
// Throws GoogleReconnectError when they need to sign in again, GoogleUnavailableError for anything else.
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const cached = cache.get(userId)
  if (cached && Date.now() < cached.expiresAt - EARLY_MS) return cached.token

  const refreshToken = await loadGoogleRefreshToken(userId)
  if (!refreshToken) throw new GoogleReconnectError()

  let res: Response
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
  } catch (err) {
    throw new GoogleUnavailableError(err instanceof Error ? err.message : 'network error')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    // invalid_grant means the saved sign-in is dead for good (revoked, expired, or the password changed).
    // Forget it so the app asks the person to sign in again instead of failing quietly every time.
    if (body?.error === 'invalid_grant') {
      await deleteGoogleRefreshToken(userId)
      throw new GoogleReconnectError()
    }
    throw new GoogleUnavailableError(`token request failed (${res.status})`)
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new GoogleUnavailableError('no access token in the response')

  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(userId, { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 })
  return json.access_token
}

// For background jobs that carry on without Google when it isn't connected.
export async function getFreshGoogleAccessToken(userId: string): Promise<string | null> {
  try {
    return await getGoogleAccessToken(userId)
  } catch (err) {
    if (!(err instanceof GoogleReconnectError)) console.error('Google access token unavailable', err)
    return null
  }
}

export async function revokeGoogleRefreshToken(userId: string) {
  const refreshToken = await loadGoogleRefreshToken(userId)
  forgetGoogleAccessToken(userId)
  if (!refreshToken) return

  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  })
}
