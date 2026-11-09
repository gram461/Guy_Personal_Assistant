import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { withGoogleAccess } from '@/lib/googleApi'
import { fetchCalendarEvents } from '@/lib/googleCalendar'
import { GoogleReconnectError } from '@/lib/googleTokenRefresh'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const events = await withGoogleAccess(user.id, fetchCalendarEvents)
    return NextResponse.json({ events })
  } catch (err) {
    // The page uses this code to offer "sign in with Google" again.
    if (err instanceof GoogleReconnectError) return NextResponse.json({ error: 'reconnect_google' }, { status: 401 })
    console.error('Calendar request failed', err)
    return NextResponse.json({ error: 'Your calendar could not be loaded. Please try again.' }, { status: 502 })
  }
}
