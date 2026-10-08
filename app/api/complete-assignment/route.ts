import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/session'
import { markAssignmentCompleted } from '@/lib/completedAssignments'

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { uid } = await req.json().catch(() => ({}))
  if (typeof uid !== 'string' || !uid || uid.length > 512) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
  }

  await markAssignmentCompleted(userId, uid)
  return NextResponse.json({ ok: true })
}
