import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/session'
import { deleteUser } from '@/lib/users'
import { revokeGoogleRefreshToken } from '@/lib/googleTokenRefresh'

export async function DELETE() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  // Revoke before deleting, since revoking needs the stored token. Deletion still runs if Google is unreachable.
  await revokeGoogleRefreshToken(userId).catch(err => console.error('Google token revoke failed', err))

  try {
    await deleteUser(userId)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Your data could not be deleted. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
