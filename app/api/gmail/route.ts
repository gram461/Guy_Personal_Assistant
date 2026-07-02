import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox',
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: 'Failed to fetch Gmail', detail: err }, { status: 500 })
  }

  const data = await res.json()
  const messageIds = (data.messages || []).map((m: any) => m.id)

  const emails = await Promise.all(
    messageIds.map(async (id: string) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
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

  return NextResponse.json({ emails })
}
