import { NextRequest, NextResponse } from 'next/server'
import { messaging } from '@/lib/firebaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { loadSettings } from '@/lib/settingsStorage'
import { buildTodaySummary, type NotificationSlot } from '@/lib/notificationContent'

const VALID_SLOTS: NotificationSlot[] = ['morning', 'afternoon', 'night']

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slot = req.nextUrl.searchParams.get('slot') as NotificationSlot | null
  if (!slot || !VALID_SLOTS.includes(slot)) {
    return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
  }

  const { notifications } = await loadSettings()
  if (!notifications[slot]) {
    return NextResponse.json({ skipped: 'slot disabled' })
  }

  const content = await buildTodaySummary(slot)
  if (!content) {
    return NextResponse.json({ skipped: 'nothing to report' })
  }

  const { data: tokenRows } = await supabaseServer.from('push_tokens').select('token')
  const tokens = (tokenRows || []).map(r => r.token)
  if (tokens.length === 0) {
    return NextResponse.json({ skipped: 'no registered devices' })
  }

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: content.title, body: content.body },
  })

  const deadTokens: string[] = []
  result.responses.forEach((r, i) => {
    if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-registration-token')) {
      deadTokens.push(tokens[i])
    }
  })
  if (deadTokens.length > 0) {
    await supabaseServer.from('push_tokens').delete().in('token', deadTokens)
  }

  return NextResponse.json({ sent: result.successCount, failed: result.failureCount })
}
