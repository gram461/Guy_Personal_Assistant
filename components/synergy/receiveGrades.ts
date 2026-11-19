import { RECEIVED_MESSAGE, readGradesMessage, type ReceivedMessage } from '@/Guy-Scraper/browser/messages'
import { SCHOOLOGY_ORIGIN } from '@/Guy-Scraper/schoologyOrigin'

// The only page that may hand grades to Synergy. Anyone else's message is ignored. (A deployer can point this at a different
// Schoology site by setting NEXT_PUBLIC_SCHOOLOGY_ORIGIN when building.)
export const TRUSTED_ORIGIN = process.env.NEXT_PUBLIC_SCHOOLOGY_ORIGIN || SCHOOLOGY_ORIGIN

type ImportResult = { ok: true; classes: number; assignments: number } | { ok: false; message?: string }

export type MessageLike = { origin: string; data: unknown; source: unknown }

// Handles messages from the Schoology tab. The helper there repeats its message until it hears back, so the same grades can
// arrive several times; they are loaded once and every copy gets the same answer.
export function createGradesReceiver(deps: {
  importGrades: (text: string) => Promise<ImportResult>
  onImported: (summary: string) => void
  trustedOrigin?: string
}) {
  const trusted = deps.trustedOrigin ?? TRUSTED_ORIGIN
  let latest: { tsv: string; reply: Promise<ReceivedMessage> } | null = null

  return async function receive(event: MessageLike): Promise<void> {
    if (event.origin !== trusted) return
    const message = readGradesMessage(event.data)
    if (!message) return

    if (!latest || latest.tsv !== message.tsv) {
      const reply = deps.importGrades(message.tsv).then((result): ReceivedMessage => {
        if (!result.ok) return { type: RECEIVED_MESSAGE, ok: false, message: result.message ?? "Synergy couldn't read those grades." }
        deps.onImported(`Loaded ${result.classes} ${result.classes === 1 ? 'class' : 'classes'} and ${result.assignments} ${result.assignments === 1 ? 'assignment' : 'assignments'} from Schoology.`)
        return { type: RECEIVED_MESSAGE, ok: true, classes: result.classes, assignments: result.assignments }
      })
      latest = { tsv: message.tsv, reply }
    }

    const reply = await latest.reply
    const source = event.source as { postMessage?: (data: unknown, targetOrigin: string) => void } | null
    source?.postMessage?.(reply, event.origin)
  }
}
