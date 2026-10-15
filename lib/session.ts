import { getServerSession } from 'next-auth'
import { authOptions } from './authOptions'
import { userExists } from './users'

export type SessionUser = { id: string; name: string | null; accessToken: string | null }

// Sign-in sessions can't be revoked, so a session whose user row was deleted (Delete my data on another device) is refused here.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id
  if (!id || !(await userExists(id))) return null
  return { id, name: session.user.name ?? null, accessToken: session.accessToken ?? null }
}

export async function getUserId(): Promise<string | null> {
  return (await getSessionUser())?.id ?? null
}
