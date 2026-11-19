import { NextRequest, NextResponse } from 'next/server'
import { fetchCalendarRange } from '@/Guy-Scraper/google/api'
import { withWebGoogle } from '@/lib/googleWeb'
import { GoogleReconnectError } from '@/lib/googleTokenRefresh'
import { getSessionUser } from '@/lib/session'

const MAX_RANGE_MS = 45 * 24 * 60 * 60 * 1000

// Events for a date range, in the shape the new screens use.
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Not signed in', reconnect: true }, { status: 401 })

  const from = new Date(req.nextUrl.searchParams.get('from') ?? '')
  const to = new Date(req.nextUrl.searchParams.get('to') ?? '')
  const span = to.getTime() - from.getTime()
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || span <= 0 || span > MAX_RANGE_MS) {
    return NextResponse.json({ ok: false, message: 'That date range is not valid.' }, { status: 400 })
  }

  try {
    const events = await withWebGoogle(user.id, token => fetchCalendarRange(token, from, to))
    return NextResponse.json({ ok: true, events })
  } catch (err) {
    // The screen uses `reconnect` to offer "sign in with Google" again.
    if (err instanceof GoogleReconnectError) return NextResponse.json({ ok: false, message: 'Google needs you to sign in again.', reconnect: true }, { status: 401 })
    console.error('Calendar request failed', err)
    return NextResponse.json({ ok: false, message: "Your calendar couldn't be loaded. Please try again." }, { status: 502 })
  }
}
