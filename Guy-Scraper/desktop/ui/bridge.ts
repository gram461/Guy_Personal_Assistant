import type { Dashboard } from '../../dashboard'
import type { Gradebook } from '../../gradebook'
import type { CalendarEvent, GoogleStatus, MailMessage } from '../../google/types'
import type { SavedEdits } from '../../savedEdits'

export type { CalendarEvent, GoogleStatus, MailMessage }

// What the window may ask the program for. Every answer is either what was asked for or { ok: false } with a plain message.
export type Failure = { ok: false; message?: string; canceled?: boolean; reconnect?: boolean }

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
  // Which program is showing these screens. The desktop app doesn't say, so no value means desktop.
  platform?: 'desktop' | 'web'
  // The website has no Schoology sign-in: people load the grades file exported from the desktop app instead.
  importGrades?: (text: string) => Promise<{ ok: true; classes: number; assignments: number } | Failure>
  status: () => Promise<({ ok: true } & Status) | Failure>
  dashboard: () => Promise<({ ok: true } & Dashboard) | Failure>
  gradebook: () => Promise<({ ok: true } & Gradebook) | Failure>
  edits: () => Promise<{ ok: true; edits: SavedEdits } | Failure>
  saveEdits: (edits: SavedEdits) => Promise<{ ok: true; edits: SavedEdits } | Failure>
  sync: () => Promise<{ ok: true; classes: number; assignments: number } | Failure>
  googleStatus: () => Promise<({ ok: true } & GoogleStatus) | Failure>
  googleConnect: () => Promise<({ ok: true } & GoogleStatus) | Failure>
  googleDisconnect: () => Promise<{ ok: true } | Failure>
  calendar: (from: string, to: string) => Promise<{ ok: true; events: CalendarEvent[] } | Failure>
  mail: () => Promise<{ ok: true; messages: MailMessage[] } | Failure>
  openExternal: (url: string) => Promise<{ ok: true } | Failure>
  signIn: () => Promise<{ ok: true; classes: number; assignments: number } | Failure>
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

export const isWeb = () => typeof window !== 'undefined' && window.synergy?.platform === 'web'

export function failureText(result: Failure, fallback: string): string {
  return result.message ?? fallback
}
