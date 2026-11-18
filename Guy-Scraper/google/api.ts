import { GoogleTokenRejectedError, type CalendarEvent, type MailMessage } from './types'

// Read-only calls to Google Calendar and Gmail. Nothing here changes anything in the person's accounts.

type RawEvent = {
  id?: string
  summary?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

export async function fetchCalendarRange(accessToken: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new GoogleTokenRejectedError()
  if (!res.ok) throw new Error(`Google Calendar answered ${res.status}`)

  const data = (await res.json()) as { items?: RawEvent[] }
  return (data.items ?? []).flatMap((e, index): CalendarEvent[] => {
    const start = e.start?.dateTime ?? e.start?.date
    if (!start) return []
    return [{
      id: e.id ?? `event-${index}`,
      title: e.summary || 'Untitled',
      start,
      end: e.end?.dateTime ?? e.end?.date ?? start,
      allDay: !e.start?.dateTime,
      location: e.location ?? '',
    }]
  })
}

type RawMessage = {
  id?: string
  threadId?: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: { headers?: { name: string; value: string }[] }
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' }

// Gmail's preview text arrives with HTML entities in it.
export const decodeSnippet = (text: string) => text.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, entity => ENTITIES[entity] ?? entity)

// "Ms. Alvarez <m.alvarez@school.example>" becomes a name and an address.
export function parseSender(from: string): { name: string; address: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) return { name: match[1].trim() || match[2].trim(), address: match[2].trim() }
  return { name: from.trim(), address: from.includes('@') ? from.trim() : '' }
}

const LIST_SIZE = 25

export async function fetchInbox(accessToken: string): Promise<MailMessage[]> {
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } }
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${LIST_SIZE}&q=in:inbox`, auth)
  if (res.status === 401) throw new GoogleTokenRejectedError()
  if (!res.ok) throw new Error(`Gmail answered ${res.status}`)

  const ids = ((await res.json()) as { messages?: { id: string }[] }).messages?.map(m => m.id) ?? []

  // One message failing to load shouldn't blank the row or hide the rest, so failed ones are left out.
  // If every one fails, that's a real problem and is reported as one.
  const loaded = await Promise.all(
    ids.map(async (id): Promise<MailMessage | 'rejected' | null> => {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          auth,
        )
        if (msgRes.status === 401) return 'rejected'
        if (!msgRes.ok) return null

        const msg = (await msgRes.json()) as RawMessage
        const header = (name: string) => msg.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value ?? ''
        const sender = parseSender(header('from'))
        const received = Number(msg.internalDate)
        return {
          id,
          threadId: msg.threadId ?? id,
          fromName: sender.name,
          fromAddress: sender.address,
          subject: header('subject') || '(no subject)',
          snippet: decodeSnippet(msg.snippet ?? ''),
          receivedAt: Number.isFinite(received) && received > 0 ? new Date(received).toISOString() : new Date(header('date') || Date.now()).toISOString(),
          unread: (msg.labelIds ?? []).includes('UNREAD'),
        }
      } catch {
        return null
      }
    }),
  )

  if (loaded.includes('rejected')) throw new GoogleTokenRejectedError()
  const messages = loaded.filter((m): m is MailMessage => m !== null && m !== 'rejected')
  if (ids.length > 0 && messages.length === 0) throw new Error('Gmail messages could not be loaded')
  return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
}
