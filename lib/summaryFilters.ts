export function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function filterTodaySummary<E extends { date: string }, A extends { date: string }>(events: E[], assignments: A[]) {
  const todayEvents = events.filter(e => daysUntil(e.date) === 0)
  const upcomingEvents = events.filter(e => daysUntil(e.date) > 0 && daysUntil(e.date) <= 7)
  const upcomingAssignments = assignments.filter(a => daysUntil(a.date) >= 0 && daysUntil(a.date) <= 7)
  const urgentItems = [...upcomingAssignments, ...upcomingEvents].filter(i => daysUntil(i.date) <= 1)

  return { todayEvents, upcomingEvents, upcomingAssignments, urgentItems }
}
