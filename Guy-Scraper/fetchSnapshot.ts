import { createSchoologyClient } from './client'
import { scrapeSnapshot } from './scrapeSnapshot'
import type { SchoologySnapshot } from './snapshot'

// Reads everything the app needs from the signed-in session (the saved login cookies).
export async function fetchSnapshot(session: string, options: { delayMs?: number } = {}): Promise<SchoologySnapshot> {
  return scrapeSnapshot(createSchoologyClient(session, options))
}
