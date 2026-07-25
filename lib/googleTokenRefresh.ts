import { supabaseServer } from './supabaseServer'

export async function saveGoogleRefreshToken(refreshToken: string) {
  await supabaseServer
    .from('google_tokens')
    .upsert({ id: 'default', refresh_token: refreshToken, updated_at: new Date().toISOString() })
}

export async function getFreshGoogleAccessToken(): Promise<string | null> {
  const { data } = await supabaseServer
    .from('google_tokens')
    .select('refresh_token')
    .eq('id', 'default')
    .single()

  if (!data?.refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null
  const json = await res.json()
  return json.access_token || null
}
