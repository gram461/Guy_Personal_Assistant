import { NextRequest, NextResponse } from 'next/server'
import { messaging } from '@/lib/firebaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { loadSettingsForUser } from '@/lib/settingsServer'
import { buildTodaySummary, type NotificationSlot } from '@/lib/notificationContent'
import { deleteEndedGradingPeriods } from '@/lib/schoologyStore'

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

  // Daily retention rides on the night slot so it doesn't need its own cron job.
  if (slot === 'night') {
    await deleteEndedGradingPeriods().catch(err => console.error('Retention cleanup failed', err))
  }

  const { data: tokenRows, error } = await supabaseServer.from('push_tokens').select('token, user_id')
  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 })
  }

  const tokensByUser = new Map<string, string[]>()
  for (const { token, user_id } of tokenRows ?? []) {
    tokensByUser.set(user_id, [...(tokensByUser.get(user_id) ?? []), token])
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  const deadTokens: string[] = []

  for (const [userId, tokens] of tokensByUser) {
    try {
      const settings = await loadSettingsForUser(userId)
      if (!settings.notifications[slot]) { skipped++; continue }

      const content = await buildTodaySummary(userId, slot, settings)
      if (!content) { skipped++; continue }

      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: content.title, body: content.body },
      })
      sent += result.successCount
      failed += result.failureCount
      result.responses.forEach((r, i) => {
        if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-registration-token')) {
          deadTokens.push(tokens[i])
        }
      })
    } catch (err) {
      console.error('Notification failed for one user', err)
      failed += tokens.length
    }
  }

  if (deadTokens.length > 0) {
    await supabaseServer.from('push_tokens').delete().in('token', deadTokens)
  }

  return NextResponse.json({ users: tokensByUser.size, sent, failed, skipped })
}
