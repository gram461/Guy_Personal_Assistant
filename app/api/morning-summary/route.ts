import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getMorningSummary } from '@/lib/dailySummary'

export async function GET() {
  const session = await getServerSession(authOptions) as any

  try {
    const summary = await getMorningSummary(session?.accessToken || null)
    return NextResponse.json({ summary })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to build morning summary', detail: err.message }, { status: 500 })
  }
}
