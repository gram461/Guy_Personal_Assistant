import { NextResponse } from 'next/server'

const ICAL_URL = 'https://fuhsd.schoology.com/calendar/feed/ical/1782351675/dcfae28486f394950a9a3152a5dd45ea/ical.ics'

function parseIcal(text: string) {
  const events = []
  const blocks = text.replace(/\r\n/g, '\n').split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Untitled'
    const dtstart = block.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim()
    const description = block.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || ''
    if (!dtstart) continue

    // Parse date like 20260625 or 20260625T080000Z
    const raw = dtstart.replace(/[TZ]/g, '').slice(0, 8)
    const year = parseInt(raw.slice(0, 4))
    const month = parseInt(raw.slice(4, 6)) - 1
    const day = parseInt(raw.slice(6, 8))
    const date = new Date(year, month, day)

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(now.getDate() - 14)
    const twoWeeksOut = new Date()
    twoWeeksOut.setDate(now.getDate() + 30)

    if (date >= twoWeeksAgo && date <= twoWeeksOut) {
      events.push({ title: summary, date: date.toISOString(), description })
    }
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export async function GET() {
  try {
    const res = await fetch(ICAL_URL, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error('Failed to fetch iCal')
    const text = await res.text()
    const events = parseIcal(text)
    return NextResponse.json({ events })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch Schoology data' }, { status: 500 })
  }
}
