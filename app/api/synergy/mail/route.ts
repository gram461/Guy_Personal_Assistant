import { NextResponse } from 'next/server'
import { fetchInbox } from '@/Guy-Scraper/google/api'
import { withWebGoogle } from '@/lib/googleWeb'
import { GoogleReconnectError } from '@/lib/googleTokenRefresh'
import { getSessionUser } from '@/lib/session'

// The inbox in the shape the new screens use: sender, subject, time, short preview, unread. Nothing is changed in Gmail.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ ok: false, message: 'Not signed in', reconnect: true }, { status: 401 })

  try {
    const messages = await withWebGoogle(user.id, fetchInbox)
    return NextResponse.json({ ok: true, messages })
  } catch (err) {
    if (err instanceof GoogleReconnectError) return NextResponse.json({ ok: false, message: 'Google needs you to sign in again.', reconnect: true }, { status: 401 })
    console.error('Gmail request failed', err)
    return NextResponse.json({ ok: false, message: "Your email couldn't be loaded. Please try again." }, { status: 502 })
  }
}
