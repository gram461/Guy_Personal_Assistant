import { getSession, signIn, signOut } from 'next-auth/react'
import { buildDashboard } from '@/Guy-Scraper/dashboard'
import { buildGradebook } from '@/Guy-Scraper/gradebook'
import { emptyEdits, sanitizeEdits, serializeEdits } from '@/Guy-Scraper/savedEdits'
import { formatTsv, parseTsv } from '@/Guy-Scraper/tsv'
import type { Failure, Synergy } from '@/Guy-Scraper/desktop/ui/bridge'

// Stands in for the desktop app's program on the website. Grades are never sent to Synergy's server:
// the person loads the file exported from the desktop app, and it is kept in this browser only.
// Google data comes from the server, which holds the person's encrypted Google sign-in.

const GRADES_KEY = 'synergy-web-grades'
const EDITS_KEY = 'synergy-web-edits'
const OTHER_KEYS = ['synergy-name', 'synergy-done']
const MAX_FILE_CHARS = 5 * 1024 * 1024

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string): boolean => {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
const remove = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage isn't available: nothing to remove.
  }
}

const ok = <T extends object>(value: T) => Promise.resolve({ ok: true as const, ...value })
const fail = (message: string): Promise<Failure> => Promise.resolve({ ok: false, message })

// The stored file if it can still be read, otherwise a header-only one, so the screens always get something valid.
function storedTsv(): string {
  const text = read(GRADES_KEY)
  if (text === null) return formatTsv([])
  try {
    parseTsv(text)
    return text
  } catch {
    return formatTsv([])
  }
}

const hasGrades = () => {
  const text = read(GRADES_KEY)
  if (text === null) return false
  try {
    return parseTsv(text).some(r => r.type === 'class')
  } catch {
    return false
  }
}

async function getJson<T>(url: string): Promise<T | Failure> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; message?: string; reconnect?: boolean }) | null
    if (body && body.ok) return body
    return { ok: false, message: body?.message ?? 'Something went wrong. Please try again.', reconnect: body?.reconnect }
  } catch {
    return { ok: false, message: 'The server could not be reached. Check your internet connection and try again.' }
  }
}

const ALLOWED_LINKS = ['https://calendar.google.com/', 'https://mail.google.com/']

export const webBridge: Synergy = {
  platform: 'web',

  status: () => {
    const rows = (() => {
      try {
        return parseTsv(storedTsv())
      } catch {
        return []
      }
    })()
    const stamps = rows.map(r => r.scraped_at).filter(Boolean).sort()
    return ok({
      dataFolder: 'This browser',
      fileName: 'grades.tsv',
      classes: rows.filter(r => r.type === 'class').length,
      assignments: rows.filter(r => r.type === 'assignment').length,
      lastSyncedAt: stamps.at(-1) ?? null,
      signedIn: hasGrades(),
    })
  },

  dashboard: () => ok(buildDashboard(storedTsv())),
  gradebook: () => ok(buildGradebook(storedTsv())),

  edits: () => {
    try {
      const text = read(EDITS_KEY)
      const data: unknown = text ? JSON.parse(text) : null
      return ok({ edits: sanitizeEdits(data) })
    } catch {
      return ok({ edits: emptyEdits() })
    }
  },
  saveEdits: edits => {
    const kept = sanitizeEdits(edits)
    return write(EDITS_KEY, serializeEdits(kept)) ? ok({ edits: kept }) : fail("Your changes couldn't be saved in this browser.")
  },

  // The website has no Schoology sign-in; these only exist so the shared screens have something to call.
  sync: () => fail('Syncing with Schoology is done in the Synergy desktop app.'),
  signIn: () => fail('Signing in to Schoology is done in the Synergy desktop app.'),

  importGrades: async text => {
    if (text.length > MAX_FILE_CHARS) return { ok: false, message: 'That file is too large to be a grades file.' }
    let classes = 0
    let assignments = 0
    try {
      const rows = parseTsv(text)
      classes = rows.filter(r => r.type === 'class').length
      assignments = rows.filter(r => r.type === 'assignment').length
      // Reading it the way the screens will catches a file that parses but can't be shown.
      buildGradebook(text)
      buildDashboard(text)
    } catch {
      return { ok: false, message: "That doesn't look like a grades file exported from Synergy." }
    }
    if (classes === 0) return { ok: false, message: 'That file has no classes in it.' }
    if (!write(GRADES_KEY, text)) return { ok: false, message: "The grades couldn't be saved in this browser." }
    return { ok: true, classes, assignments }
  },

  // "Sign out" of grades on the website means taking them out of this browser.
  signOut: () => {
    remove(GRADES_KEY)
    remove(EDITS_KEY)
    return ok({})
  },

  exportTsv: () => {
    const url = URL.createObjectURL(new Blob([storedTsv()], { type: 'text/tab-separated-values' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'grades.tsv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return ok({ path: 'grades.tsv' })
  },
  openFolder: () => fail('There is no data folder on the website. Your data is kept in this browser.'),

  deleteData: async () => {
    if (!window.confirm('Delete all of your Synergy data? This erases the grades you imported and the scores you entered from this browser, and your Synergy account and saved Google sign-in if you signed in. It cannot be undone.')) {
      return { ok: false, canceled: true }
    }
    const session = await getSession()
    if (session) {
      try {
        const res = await fetch('/api/account-data', { method: 'DELETE' })
        if (!res.ok) return { ok: false, message: "Your account data couldn't be deleted. Please try again." }
      } catch {
        return { ok: false, message: 'The server could not be reached. Please try again.' }
      }
    }
    for (const key of [GRADES_KEY, EDITS_KEY, ...OTHER_KEYS]) remove(key)
    if (session) await signOut({ redirect: false })
    return { ok: true }
  },

  googleStatus: async () => {
    const session = await getSession()
    return { ok: true, configured: true, connected: !!session, email: session?.user?.email ?? null }
  },
  googleConnect: async () => {
    // Leaves for Google's sign-in page and comes back signed in.
    await signIn('google', { callbackUrl: '/app' })
    return { ok: true, configured: true, connected: false, email: null }
  },
  googleDisconnect: async () => {
    try {
      const res = await fetch('/api/synergy/google-disconnect', { method: 'POST' })
      if (!res.ok) return { ok: false, message: "Couldn't disconnect Google. Please try again." }
    } catch {
      return { ok: false, message: 'The server could not be reached. Please try again.' }
    }
    await signOut({ redirect: false })
    return { ok: true }
  },

  calendar: (from, to) => getJson(`/api/synergy/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  mail: () => getJson('/api/synergy/mail'),

  openExternal: url => {
    if (!ALLOWED_LINKS.some(prefix => url.startsWith(prefix))) return fail('That address is not allowed.')
    window.open(url, '_blank', 'noopener,noreferrer')
    return ok({})
  },
}
