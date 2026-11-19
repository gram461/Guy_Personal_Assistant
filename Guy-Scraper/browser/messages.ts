// What the Schoology tab and the Synergy tab say to each other. Used by both ends, so they can't drift apart.

export const GRADES_MESSAGE = 'synergy-grades'
export const RECEIVED_MESSAGE = 'synergy-received'
export const MAX_TSV_CHARS = 5 * 1024 * 1024

export type GradesMessage = { type: typeof GRADES_MESSAGE; version: 1; tsv: string }
export type ReceivedMessage = { type: typeof RECEIVED_MESSAGE; ok: boolean; classes?: number; assignments?: number; message?: string }

// The grades from the Schoology tab, if the message is exactly that and nothing odd.
export function readGradesMessage(data: unknown): GradesMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const m = data as Partial<GradesMessage>
  if (m.type !== GRADES_MESSAGE || m.version !== 1) return null
  if (typeof m.tsv !== 'string' || m.tsv.length === 0 || m.tsv.length > MAX_TSV_CHARS) return null
  return { type: GRADES_MESSAGE, version: 1, tsv: m.tsv }
}

export function readReceivedMessage(data: unknown): ReceivedMessage | null {
  if (typeof data !== 'object' || data === null) return null
  const m = data as Partial<ReceivedMessage>
  if (m.type !== RECEIVED_MESSAGE || typeof m.ok !== 'boolean') return null
  return {
    type: RECEIVED_MESSAGE,
    ok: m.ok,
    classes: typeof m.classes === 'number' ? m.classes : undefined,
    assignments: typeof m.assignments === 'number' ? m.assignments : undefined,
    message: typeof m.message === 'string' ? m.message.slice(0, 300) : undefined,
  }
}
