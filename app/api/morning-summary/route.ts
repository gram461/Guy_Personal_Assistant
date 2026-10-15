import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { getMorningSummary } from '@/lib/dailySummary'
import { loadSettingsForUser } from '@/lib/settingsServer'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const { displayName } = await loadSettingsForUser(user.id)
    const name = displayName || user.name?.split(' ')[0] || ''
    const summary = await getMorningSummary(user.id, name, user.accessToken)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to build morning summary' }, { status: 500 })
  }
}
