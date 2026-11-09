import { GoogleTokenRejectedError } from './googleApi'

export type CalendarEvent = { title: string; date: string; location: string }

type RawEvent = { summary?: string; location?: string; start?: { dateTime?: string; date?: string } }

export async function fetchCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date().toISOString()
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${twoWeeks}&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (res.status === 401) throw new GoogleTokenRejectedError()
  if (!res.ok) throw new Error(`Google Calendar answered ${res.status}`)

  const data = (await res.json()) as { items?: RawEvent[] }
  return (data.items || []).map(e => ({
    title: e.summary || 'Untitled',
    date: e.start?.dateTime || e.start?.date || '',
    location: e.location || '',
  }))
}
