const ICAL_URL = 'https://fuhsd.schoology.com/calendar/feed/ical/1782351675/dcfae28486f394950a9a3152a5dd45ea/ical.ics'

export type SchoologyEvent = { title: string; date: string; description: string }

function parseIcal(text: string): SchoologyEvent[] {
  const events: SchoologyEvent[] = []
  const blocks = text.replace(/\r\n/g, '\n').split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Untitled'
    const dtstart = block.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim()
    const description = block.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || ''
    if (!dtstart) continue

    // Parse date like 20260625 or 20260625T080000Z
    const isUtc = dtstart.endsWith('Z')
    const hasTime = dtstart.includes('T')
    const raw = dtstart.replace(/[TZ]/g, '')
    const year = parseInt(raw.slice(0, 4))
    const month = parseInt(raw.slice(4, 6)) - 1
    const day = parseInt(raw.slice(6, 8))
    const hour = hasTime ? parseInt(raw.slice(8, 10)) : 0
    const minute = hasTime ? parseInt(raw.slice(10, 12)) : 0
    const second = hasTime ? parseInt(raw.slice(12, 14)) || 0 : 0

    const date = !hasTime
      ? new Date(year, month, day)
      : isUtc
        ? new Date(Date.UTC(year, month, day, hour, minute, second))
        : new Date(year, month, day, hour, minute, second)

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(now.getDate() - 14)
    const twoWeeksOut = new Date()
    twoWeeksOut.setDate(now.getDate() + 30)

    if (date >= twoWeeksAgo && date <= twoWeeksOut) {
      const dateOut = hasTime
        ? date.toISOString()
        : `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      events.push({ title: summary, date: dateOut, description })
    }
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export async function fetchSchoologyEvents(): Promise<SchoologyEvent[]> {
  const res = await fetch(ICAL_URL, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error('Failed to fetch iCal')
  const text = await res.text()
  return parseIcal(text)
}
