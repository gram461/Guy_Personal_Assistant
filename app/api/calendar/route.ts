import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { fetchCalendarEvents } from '@/lib/googleCalendar'

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  try {
    const events = await fetchCalendarEvents(session.accessToken)
    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch calendar', detail: err.message }, { status: 500 })
  }
}
