export type GmailMessage = { id: string; from: string; subject: string; date: string; unread: boolean; snippet: string }

export async function fetchGmailMessages(accessToken: string): Promise<GmailMessage[]> {
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to fetch Gmail: ${err}`)
  }

  const data = await res.json()
  const messageIds = (data.messages || []).map((m: any) => m.id)

  return Promise.all(
    messageIds.map(async (id: string) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const msg = await msgRes.json()
      const headers = msg.payload?.headers || []
      const get = (name: string) => headers.find((h: any) => h.name === name)?.value || ''
      const unread = (msg.labelIds || []).includes('UNREAD')

      return {
        id,
        from: get('From'),
        subject: get('Subject'),
        date: get('Date'),
        unread,
        snippet: msg.snippet || '',
      }
    })
  )
}
