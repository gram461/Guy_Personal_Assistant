// When someone opens the website in Safari on an iPhone or iPad, we offer to add it to the Home Screen as an app.
// iOS has no way for a page to open its own "Add to Home Screen" box, so the button opens the share sheet, which has that choice in it.

const DISMISSED_KEY = 'synergy-install-dismissed'
const ASK_AGAIN_AFTER_MS = 14 * 24 * 60 * 60 * 1000

export type InstallContext = {
  ios: boolean
  installed: boolean // already opened from the Home Screen
  phoneApp: boolean // inside the native phone shell
  dismissedAt: number | null
  now: number
}

export function shouldOfferInstall({ ios, installed, phoneApp, dismissedAt, now }: InstallContext): boolean {
  if (!ios || installed || phoneApp) return false
  if (dismissedAt !== null && now - dismissedAt < ASK_AGAIN_AFTER_MS) return false
  return true
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

export function readDismissedAt(storage: Storage | undefined): number | null {
  try {
    const value = Number(storage?.getItem(DISMISSED_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function rememberDismissed(storage: Storage | undefined, now: number) {
  try {
    storage?.setItem(DISMISSED_KEY, String(now))
  } catch {
    // Private browsing can refuse to save. The prompt just comes back next time.
  }
}

type Sharer = { share?: (data: { title?: string; url?: string }) => Promise<void> }

export type ShareOutcome = 'shared' | 'cancelled' | 'unavailable'

// Opens the iOS share sheet for this page. 'cancelled' means the person closed the sheet without choosing anything.
export async function openShareSheet(nav: Sharer, url: string): Promise<ShareOutcome> {
  if (typeof nav.share !== 'function') return 'unavailable'
  try {
    await nav.share({ title: 'Synergy', url })
    return 'shared'
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'unavailable'
  }
}
