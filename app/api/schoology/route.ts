import { NextResponse } from 'next/server'
import { fetchSchoologyEvents } from '@/lib/schoology'

export async function GET() {
  try {
    const events = await fetchSchoologyEvents()
    return NextResponse.json({ events })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch Schoology data' }, { status: 500 })
  }
}
