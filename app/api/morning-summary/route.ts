import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getMorningSummary } from '@/lib/dailySummary'
import { loadSettingsForUser } from '@/lib/settingsServer'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const { displayName } = await loadSettingsForUser(userId)
    const name = displayName || session.user.name?.split(' ')[0] || ''
    const summary = await getMorningSummary(userId, name, session.accessToken ?? null)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to build morning summary' }, { status: 500 })
  }
}
