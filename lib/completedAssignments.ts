import { supabaseServer } from './supabaseServer'

export async function getCompletedUids(): Promise<Set<string>> {
  try {
    const { data } = await supabaseServer.from('completed_assignments').select('uid')
    return new Set((data ?? []).map((r: { uid: string }) => r.uid))
  } catch {
    return new Set()
  }
}

export async function markAssignmentCompleted(uid: string) {
  await supabaseServer.from('completed_assignments').upsert({ uid })
}
