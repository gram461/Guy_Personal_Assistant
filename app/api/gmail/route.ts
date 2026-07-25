import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { fetchGmailMessages } from '@/lib/gmail'

export async function GET() {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  try {
    const emails = await fetchGmailMessages(session.accessToken)
    return NextResponse.json({ emails })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch Gmail', detail: err.message }, { status: 500 })
  }
}
