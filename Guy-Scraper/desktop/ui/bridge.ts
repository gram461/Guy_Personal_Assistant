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
  platform?: 'desktop' | 'web' | 'app'
  // The website has no Schoology sign-in: people load the grades file exported from the desktop app instead.
  // Website only: the "Get my grades" bookmark people drag to their bookmarks bar.
  grabberLink?: () => string
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

// True when the website was added to the home screen and opened from there: it runs in its own window, without the browser around it.
// (Safari reports this with navigator.standalone; other browsers with the display-mode setting.)
export const isInstalledApp = () => {
  if (typeof window === 'undefined') return false
  const modes = ['standalone', 'fullscreen', 'minimal-ui']
  return modes.some(mode => window.matchMedia?.(`(display-mode: ${mode})`).matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// iPhones and iPads keep an installed web app's saved data apart from Safari's.
export const isIosDevice = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export const isWeb = () => typeof window !== 'undefined' && window.synergy?.platform === 'web'
// The phone app: it signs in to Schoology like the desktop app does, but keeps its data on the phone.
export const isApp = () => typeof window !== 'undefined' && window.synergy?.platform === 'app'

export function failureText(result: Failure, fallback: string): string {
  return result.message ?? fallback
}
