import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${twoWeeks}&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: 'Failed to fetch calendar', detail: err }, { status: 500 })
  }

  const data = await res.json()
  const events = (data.items || []).map((e: any) => ({
    title: e.summary || 'Untitled',
    date: e.start?.dateTime || e.start?.date,
    location: e.location || '',
  }))

  return NextResponse.json({ events })
}
