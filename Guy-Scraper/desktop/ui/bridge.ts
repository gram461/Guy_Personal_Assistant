import type { Dashboard } from '../../dashboard'
import type { Gradebook } from '../../gradebook'
import type { SavedEdits } from '../../savedEdits'

// What the window may ask the program for. Every answer is either what was asked for or { ok: false } with a plain message.
export type Failure = { ok: false; message?: string; canceled?: boolean }

export type Status = {
  dataFolder: string
  fileName: string
  classes: number
  assignments: number
  lastSyncedAt: string | null
  // A Schoology sign-in is saved on this computer. Whether Schoology still accepts it shows up on the next sync.
  signedIn: boolean
}

export type Synergy = {
  status: () => Promise<({ ok: true } & Status) | Failure>
  dashboard: () => Promise<({ ok: true } & Dashboard) | Failure>
  gradebook: () => Promise<({ ok: true } & Gradebook) | Failure>
  edits: () => Promise<{ ok: true; edits: SavedEdits } | Failure>
  saveEdits: (edits: SavedEdits) => Promise<{ ok: true; edits: SavedEdits } | Failure>
  sync: () => Promise<{ ok: true; classes: number; assignments: number } | Failure>
  signOut: () => Promise<{ ok: true } | Failure>
  exportTsv: () => Promise<{ ok: true; path: string } | Failure>
  openFolder: () => Promise<{ ok: true } | Failure>
  deleteData: () => Promise<{ ok: true } | Failure>
}

declare global {
  interface Window {
    synergy: Synergy
  }
}

export const synergy = (): Synergy => window.synergy

export function failureText(result: Failure, fallback: string): string {
  return result.message ?? fallback
}
