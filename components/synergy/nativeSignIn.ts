import { readErrorMessage, readGradesMessage, type ErrorReason } from '@/Guy-Scraper/browser/messages'

// The phone app's way to get grades: open Schoology in the app's own window, let the person sign in, then read their grades from
// inside that window. Only the parts of the in-app browser plugin that are used here are described, so this file can be tested
// with a stand-in and doesn't need the plugin to be installed in the website.

type Handle = { remove: () => Promise<void> | void }
export type InAppBrowserLike = {
  openWebView: (options: { url: string; title?: string }) => Promise<{ id: string }>
  addListener(event: 'urlChangeEvent', listener: (e: { id?: string; url: string }) => void): Promise<Handle>
  addListener(event: 'messageFromWebview', listener: (e: { id?: string; detail?: Record<string, unknown> }) => void): Promise<Handle>
  addListener(event: 'closeEvent', listener: (e: { id?: string }) => void): Promise<Handle>
  executeScript: (options: { code: string; id?: string }) => Promise<void>
  close: (options?: { id?: string }) => Promise<unknown>
  clearCookies: (options: { url: string; id?: string }) => Promise<unknown>
}

export type SignInDeps = {
  plugin: InAppBrowserLike
  // The text of the helper script to run inside the Schoology window.
  loadHelperCode: () => Promise<string>
  schoologyOrigin: string
  timeoutMs?: number
}

export type SignInResult = { ok: true; tsv: string } | { ok: false; message: string }

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000

const REASON_TEXT: Record<ErrorReason, string> = {
  'signed-out': "Schoology says you're signed out. Please sign in and try again.",
  layout: "Schoology's pages look different than expected, so nothing was changed. The app may need an update.",
  network: "Couldn't read Schoology. Check your internet connection and try again.",
  'no-classes': 'No classes were found. Make sure you are signed in to Schoology and try again.',
  'wrong-site': "That wasn't the Schoology page, so nothing was changed.",
}

// True only for the Schoology home page itself: same site, whatever comes after the first path piece. Lookalike addresses don't count.
export function isSchoologyHome(url: string, schoologyOrigin: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.origin === schoologyOrigin && (parsed.pathname === '/home' || parsed.pathname.startsWith('/home/'))
  } catch {
    return false
  }
}

// Opens the sign-in window and resolves with the grades file text, or why there isn't one. `fresh` signs out first, so a different
// account can sign in. The window closes by itself as soon as the grades are read.
export async function signInAndRead(deps: SignInDeps, options: { fresh: boolean }): Promise<SignInResult> {
  const { plugin, schoologyOrigin } = deps
  if (options.fresh) await plugin.clearCookies({ url: schoologyOrigin }).catch(() => undefined)

  let viewId: string | null = null
  const handles: Handle[] = []
  let settle: (result: SignInResult) => void = () => {}
  const outcome = new Promise<SignInResult>(resolve => {
    settle = resolve
  })

  let reading = false
  const mine = (id?: string) => viewId === null || id === undefined || id === viewId

  try {
    // One at a time, so if a later one fails the earlier ones are still cleaned up below.
    handles.push(
      await plugin.addListener('urlChangeEvent', event => {
        if (!mine(event.id) || reading || !isSchoologyHome(event.url, schoologyOrigin)) return
        // Once is enough: Schoology changes its address many times while the home page loads.
        reading = true
        void deps
          .loadHelperCode()
          .then(code => plugin.executeScript({ code, id: viewId ?? undefined }))
          .catch(() => settle({ ok: false, message: "Couldn't read Schoology. Check your internet connection and try again." }))
      }),
    )
    handles.push(
      await plugin.addListener('messageFromWebview', event => {
        if (!mine(event.id)) return
        const grades = readGradesMessage(event.detail)
        if (grades) return settle({ ok: true, tsv: grades.tsv })
        const reason = readErrorMessage(event.detail)
        if (reason) settle({ ok: false, message: REASON_TEXT[reason] })
      }),
    )
    handles.push(
      await plugin.addListener('closeEvent', event => {
        if (mine(event.id)) settle({ ok: false, message: "Sign-in wasn't finished, so nothing was changed." })
      }),
    )

    const timer = setTimeout(() => settle({ ok: false, message: "Sign-in wasn't finished, so nothing was changed." }), deps.timeoutMs ?? SIGN_IN_TIMEOUT_MS)
    viewId = (await plugin.openWebView({ url: `${schoologyOrigin}/`, title: 'Sign in to Schoology' })).id
    const result = await outcome
    clearTimeout(timer)
    return result
  } catch {
    return { ok: false, message: "Couldn't open the Schoology sign-in window. Please try again." }
  } finally {
    await Promise.all(handles.map(handle => Promise.resolve(handle.remove()).catch(() => undefined)))
    // Closing also happens after an error or a cancel; it is harmless if the window is already gone.
    await plugin.close(viewId ? { id: viewId } : undefined).catch(() => undefined)
  }
}
