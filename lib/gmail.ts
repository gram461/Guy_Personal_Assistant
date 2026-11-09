import { GoogleTokenRejectedError } from './googleApi'

export type GmailMessage = { id: string; from: string; subject: string; date: string; unread: boolean; snippet: string }

type RawMessage = { snippet?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }

export async function fetchGmailMessages(accessToken: string): Promise<GmailMessage[]> {
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } }
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox', auth)

  if (res.status === 401) throw new GoogleTokenRejectedError()
  if (!res.ok) throw new Error(`Gmail answered ${res.status}`)

  const data = (await res.json()) as { messages?: { id: string }[] }
  const messageIds = (data.messages || []).map(m => m.id)

  // One message failing to load shouldn't blank the row or hide the rest, so failed ones are left out.
  // If every one fails, that's a real problem and is reported as one.
  const loaded = await Promise.all(
    messageIds.map(async (id): Promise<GmailMessage | 'rejected' | null> => {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          auth
        )
        if (msgRes.status === 401) return 'rejected'
        if (!msgRes.ok) return null

        const msg = (await msgRes.json()) as RawMessage
        const headers = msg.payload?.headers || []
        const get = (name: string) => headers.find(h => h.name === name)?.value || ''
        return {
          id,
          from: get('From'),
          subject: get('Subject'),
          date: get('Date'),
          unread: (msg.labelIds || []).includes('UNREAD'),
          snippet: msg.snippet || '',
        }
      } catch {
        return null
      }
    })
  )

  if (loaded.includes('rejected')) throw new GoogleTokenRejectedError()
  const messages = loaded.filter((m): m is GmailMessage => m !== null && m !== 'rejected')
  if (messageIds.length > 0 && messages.length === 0) throw new Error('Gmail messages could not be loaded')
  return messages
}
