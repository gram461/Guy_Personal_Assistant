import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { token } = await req.json().catch(() => ({}))
  if (typeof token !== 'string' || !token || token.length > 4096) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from('push_tokens')
    .upsert({ token, user_id: userId, last_seen_at: new Date().toISOString() })
  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to save device' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
