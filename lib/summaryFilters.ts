const PACIFIC_TZ = 'America/Los_Angeles'

function pacificDateOnly(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: PACIFIC_TZ })
}

// All-day items come as a bare "YYYY-MM-DD", which is already the Pacific day. new Date() would read it
// as midnight UTC, which is the evening before in Pacific time.
const isDateOnly = (dateStr: string) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
const dayKey = (dateStr: string) => (isDateOnly(dateStr) ? dateStr : pacificDateOnly(new Date(dateStr)))

export function formatDay(dateStr: string) {
  return new Date(`${dayKey(dateStr)}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function daysUntil(dateStr: string) {
  const todayKey = pacificDateOnly(new Date())
  const targetKey = dayKey(dateStr)
  const today = new Date(`${todayKey}T00:00:00Z`)
  const target = new Date(`${targetKey}T00:00:00Z`)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function filterTodaySummary<E extends { date: string }, A extends { date: string }>(events: E[], assignments: A[]) {
  const todayEvents = events.filter(e => daysUntil(e.date) === 0)
  const upcomingEvents = events.filter(e => daysUntil(e.date) > 0 && daysUntil(e.date) <= 7)
  const upcomingAssignments = assignments.filter(a => daysUntil(a.date) >= 0 && daysUntil(a.date) <= 7)
  const urgentItems = [...upcomingAssignments, ...upcomingEvents].filter(i => daysUntil(i.date) <= 1)

  return { todayEvents, upcomingEvents, upcomingAssignments, urgentItems }
}
