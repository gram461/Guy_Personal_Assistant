import { supabaseServer } from './supabaseServer'

export async function ensureUser(userId: string) {
  const { error } = await supabaseServer
    .from('users')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) throw new Error(`Failed to create user: ${error.message}`)
}

export async function userExists(userId: string): Promise<boolean> {
  const { data, error } = await supabaseServer.from('users').select('user_id').eq('user_id', userId).maybeSingle()
  return !error && !!data
}

export async function deleteUser(userId: string) {
  const { error } = await supabaseServer.from('users').delete().eq('user_id', userId)
  if (error) throw new Error(`Failed to delete user: ${error.message}`)
}
