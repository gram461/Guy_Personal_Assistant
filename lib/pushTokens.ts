import { supabase } from './supabaseClient'

export async function savePushToken(token: string) {
  await supabase.from('push_tokens').upsert({ token, last_seen_at: new Date().toISOString() })
}
