import { fetchSchoologyEvents } from './schoology'
import { fetchCalendarEvents } from './googleCalendar'
import { fetchGmailMessages } from './gmail'
import { getFreshGoogleAccessToken } from './googleTokenRefresh'
import { filterTodaySummary, daysUntil } from './summaryFilters'
import { loadSettings } from './settingsStorage'
import { classifyImportantAssignments } from './assignmentImportance'

export type NotificationSlot = 'morning' | 'afternoon' | 'night'

export async function buildTodaySummary(slot: NotificationSlot): Promise<{ title: string; body: string } | null> {
  const assignments = await fetchSchoologyEvents()

  const accessToken = await getFreshGoogleAccessToken()
  const events = accessToken ? await fetchCalendarEvents(accessToken) : []
  const emails = accessToken ? await fetchGmailMessages(accessToken) : []
  const unreadCount = emails.filter(e => e.unread).length

  const { todayEvents, upcomingAssignments, urgentItems } = filterTodaySummary(events, assignments)

  const important = await classifyImportantAssignments(assignments)
  const alertPrefix = important.length > 0
    ? important.map(a => {
        const days = daysUntil(a.date)
        const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
        return `⚠️ ${a.title} — ${a.reason}. Due ${when}.`
      }).join(' ') + ' '
    : ''

  if (slot === 'morning') {
    if (todayEvents.length === 0 && upcomingAssignments.length === 0 && !alertPrefix) return null
    return {
      title: 'Good morning, Guy',
      body: `${alertPrefix}Today: ${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''}, ${upcomingAssignments.length} assignment${upcomingAssignments.length !== 1 ? 's' : ''} due this week.`,
    }
  }

  if (slot === 'afternoon') {
    if (urgentItems.length === 0 && unreadCount === 0 && !alertPrefix) return null
    const parts: string[] = []
    if (urgentItems.length > 0) {
      const names = urgentItems.slice(0, 2).map(i => i.title).join(', ')
      parts.push(`Due today/tomorrow: ${names}`)
    }
    if (unreadCount > 0) parts.push(`${unreadCount} unread email${unreadCount !== 1 ? 's' : ''}`)
    return { title: 'Afternoon check-in', body: alertPrefix + parts.join(' · ') }
  }

  // night
  const { nightlyChecklist } = await loadSettings()
  const checklistPrompts = [
    nightlyChecklist.studied && 'studied',
    nightlyChecklist.workedOut && 'worked out',
    nightlyChecklist.packed && 'packed your bag',
  ].filter(Boolean)

  const dueSoon = upcomingAssignments.filter(a => daysUntil(a.date) <= 1)
  const bodyParts: string[] = []
  if (checklistPrompts.length > 0) bodyParts.push(`Did you ${checklistPrompts.join(', ')}?`)
  if (dueSoon.length > 0) bodyParts.push(`Due soon: ${dueSoon.map(a => a.title).join(', ')}`)

  if (bodyParts.length === 0 && !alertPrefix) return null
  return { title: 'Night check-in', body: alertPrefix + bodyParts.join(' ') }
}
