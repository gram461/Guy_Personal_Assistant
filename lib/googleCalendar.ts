export type CalendarEvent = { title: string; date: string; location: string }

export async function fetchCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date().toISOString()
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${twoWeeks}&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to fetch calendar: ${err}`)
  }

  const data = await res.json()
  return (data.items || []).map((e: any) => ({
    title: e.summary || 'Untitled',
    date: e.start?.dateTime || e.start?.date,
    location: e.location || '',
  }))
}
