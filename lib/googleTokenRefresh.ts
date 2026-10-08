import { supabaseServer } from './supabaseServer'
import { encryptSecret, decryptSecret } from './tokenCrypto'

const encryptionContext = (userId: string) => `google_refresh_token:${userId}`

export async function saveGoogleRefreshToken(userId: string, refreshToken: string) {
  const { error } = await supabaseServer.from('google_tokens').upsert({
    user_id: userId,
    refresh_token_encrypted: encryptSecret(refreshToken, encryptionContext(userId)),
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Failed to save Google token: ${error.message}`)
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

export async function getFreshGoogleAccessToken(userId: string): Promise<string | null> {
  const refreshToken = await loadGoogleRefreshToken(userId)
  if (!refreshToken) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null
  const json = await res.json()
  return json.access_token || null
}

export async function revokeGoogleRefreshToken(userId: string) {
  const refreshToken = await loadGoogleRefreshToken(userId)
  if (!refreshToken) return

  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  })
}
