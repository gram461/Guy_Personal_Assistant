import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { fetchGmailMessages } from '@/lib/gmail'
import { withGoogleAccess } from '@/lib/googleApi'
import { GoogleReconnectError } from '@/lib/googleTokenRefresh'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  try {
    const emails = await withGoogleAccess(user.id, fetchGmailMessages)
    return NextResponse.json({ emails })
  } catch (err) {
    // The page uses this code to offer "sign in with Google" again.
    if (err instanceof GoogleReconnectError) return NextResponse.json({ error: 'reconnect_google' }, { status: 401 })
    console.error('Gmail request failed', err)
    return NextResponse.json({ error: 'Your email could not be loaded. Please try again.' }, { status: 502 })
  }
}
