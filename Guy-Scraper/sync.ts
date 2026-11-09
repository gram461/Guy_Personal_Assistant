import { loadSchoologySession, recordSyncResult, saveSchoologySnapshot } from '../lib/schoologyStore'
import { SessionExpiredError } from './errors'
import { fetchSnapshot } from './fetchSnapshot'

export type SyncOutcome = 'ok' | 'not_connected' | 'session_expired' | 'failed'

export async function syncUser(userId: string): Promise<SyncOutcome> {
  const connection = await loadSchoologySession(userId)
  if (!connection) return 'not_connected'

  try {
    await saveSchoologySnapshot(userId, await fetchSnapshot(connection.session))
    await recordSyncResult(userId, 'ok')
    return 'ok'
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      await recordSyncResult(userId, 'session_expired')
      return 'session_expired'
    }
    console.error('Schoology sync failed', err instanceof Error ? err.message : 'unknown error')
    await recordSyncResult(userId, 'failed')
    return 'failed'
  }
}
