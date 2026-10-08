import { supabaseServer } from './supabaseServer'

export async function getCompletedUids(userId: string): Promise<Set<string>> {
  try {
    const { data } = await supabaseServer.from('completed_assignments').select('uid').eq('user_id', userId)
    return new Set((data ?? []).map((r: { uid: string }) => r.uid))
  } catch {
    return new Set()
  }
}

export async function markAssignmentCompleted(userId: string, uid: string) {
  await supabaseServer.from('completed_assignments').upsert({ user_id: userId, uid })
}
