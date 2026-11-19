import { NextResponse } from 'next/server'
import { deleteGoogleRefreshToken, revokeGoogleRefreshToken } from '@/lib/googleTokenRefresh'
import { getUserId } from '@/lib/session'

// Takes Synergy's access to this person's Google account away: tells Google to drop it, then forgets the saved sign-in.
export async function POST() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ ok: false, message: 'Not signed in' }, { status: 401 })

  // Revoking needs the saved sign-in, so it goes first. The sign-in is forgotten even if Google can't be reached.
  await revokeGoogleRefreshToken(userId).catch(err => console.error('Google token revoke failed', err))
  try {
    await deleteGoogleRefreshToken(userId)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok: false, message: "Couldn't disconnect Google. Please try again." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
