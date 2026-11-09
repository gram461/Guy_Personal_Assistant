import { fetchGmailMessages, type GmailMessage } from './gmail'
import { withGoogleAccess } from './googleApi'
import { fetchCalendarEvents, type CalendarEvent } from './googleCalendar'
import { GoogleReconnectError } from './googleTokenRefresh'

// For background work (notifications, the morning summary) that should carry on without Google rather than fail:
// not connected, or Google having a problem, gives an empty list.
async function orEmpty<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load()
  } catch (err) {
    if (!(err instanceof GoogleReconnectError)) console.error(`${label} unavailable`, err)
    return []
  }
}

export const calendarEventsOrNone = (userId: string): Promise<CalendarEvent[]> =>
  orEmpty('Google Calendar', () => withGoogleAccess(userId, fetchCalendarEvents))

export const gmailMessagesOrNone = (userId: string): Promise<GmailMessage[]> =>
  orEmpty('Gmail', () => withGoogleAccess(userId, fetchGmailMessages))
