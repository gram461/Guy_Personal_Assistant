import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/session'
import { fetchAssignments } from '@/lib/assignments'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const assignments = await fetchAssignments(userId)
    return NextResponse.json({ assignments })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 })
  }
}
