import { NextResponse } from 'next/server'
import { markAssignmentCompleted } from '@/lib/completedAssignments'

export async function POST(req: Request) {
  const { uid } = await req.json()
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
  await markAssignmentCompleted(uid)
  return NextResponse.json({ ok: true })
}
