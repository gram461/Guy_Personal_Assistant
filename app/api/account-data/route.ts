import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabaseServer'
import { revokeGoogleRefreshToken } from '@/lib/googleTokenRefresh'

const USER_TABLES = ['google_tokens', 'push_tokens', 'completed_assignments', 'morning_summaries', 'settings'] as const

export async function DELETE() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // Revoke before deleting the row, since revoking needs the stored token. Deletion still runs if Google is unreachable.
  await revokeGoogleRefreshToken(userId).catch(err => console.error('Google token revoke failed', err))

  const results = await Promise.all(
    USER_TABLES.map(table => supabaseServer.from(table).delete().eq('user_id', userId)),
  )
  const failed = results.filter(r => r.error)
  if (failed.length > 0) {
    failed.forEach(r => console.error(r.error))
    return NextResponse.json({ error: 'Some data could not be deleted. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
