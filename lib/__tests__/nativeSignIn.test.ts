import { afterEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGE, GRADES_MESSAGE } from '@/Guy-Scraper/browser/messages'
import type { Synergy } from '@/Guy-Scraper/desktop/ui/bridge'
import { createAppBridge } from '@/components/synergy/appBridge'
import { isSchoologyHome, signInAndRead, type InAppBrowserLike } from '@/components/synergy/nativeSignIn'

const SCHOOL = 'https://fuhsd.schoology.com'
type Event = 'urlChangeEvent' | 'messageFromWebview' | 'closeEvent'

// Plays the part of the in-app browser plugin, so a test can be the "person" signing in.
function fakePlugin() {
  const listeners: Record<Event, ((payload: never) => void)[]> = { urlChangeEvent: [], messageFromWebview: [], closeEvent: [] }
  const plugin = {
    openWebView: vi.fn(async () => ({ id: 'w1' })),
    addListener: vi.fn(async (event: Event, callback: (payload: never) => void) => {
      listeners[event].push(callback)
      return { remove: vi.fn(async () => void (listeners[event] = listeners[event].filter(c => c !== callback))) }
    }),
    executeScript: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    clearCookies: vi.fn(async () => {}),
  }
  const emit = (event: Event, payload: unknown) => listeners[event].slice().forEach(callback => callback(payload as never))
  return { plugin: plugin as unknown as InAppBrowserLike & typeof plugin, emit, listeners }
}

const deps = (plugin: InAppBrowserLike, extra: object = {}) => ({ plugin, schoologyOrigin: SCHOOL, loadHelperCode: async () => 'HELPER_CODE', ...extra })
const opened = (plugin: { openWebView: ReturnType<typeof vi.fn> }) => vi.waitFor(() => expect(plugin.openWebView).toHaveBeenCalled())
const grades = (tsv = 'the-grades') => ({ type: GRADES_MESSAGE, version: 1, tsv })

afterEach(() => vi.useRealTimers())

describe('isSchoologyHome', () => {
  it('is true only for the real Schoology home page', () => {
    for (const url of [`${SCHOOL}/home`, `${SCHOOL}/home#/?_k=abc`, `${SCHOOL}/home/overdue`]) expect(isSchoologyHome(url, SCHOOL)).toBe(true)
    for (const url of [`${SCHOOL}/`, `${SCHOOL}/login`, `${SCHOOL}/homework`, 'https://fuhsd.schoology.com.evil.example/home', 'https://evil.example/home', 'http://fuhsd.schoology.com/home', 'not a url']) {
      expect(isSchoologyHome(url, SCHOOL)).toBe(false)
    }
  })
})

describe('signInAndRead', () => {
  it('opens Schoology, waits for the home page, reads the grades there, and closes the window', async () => {
    const { plugin, emit } = fakePlugin()
    const pending = signInAndRead(deps(plugin), { fresh: false })
    await opened(plugin)
    expect(plugin.openWebView).toHaveBeenCalledWith({ url: `${SCHOOL}/`, title: 'Sign in to Schoology' })

    emit('urlChangeEvent', { id: 'w1', url: `${SCHOOL}/login` })
    expect(plugin.executeScript).not.toHaveBeenCalled() // still signing in

    emit('urlChangeEvent', { id: 'w1', url: `${SCHOOL}/home#/?_k=abc` })
    await vi.waitFor(() => expect(plugin.executeScript).toHaveBeenCalledWith({ code: 'HELPER_CODE', id: 'w1' }))
    emit('messageFromWebview', { id: 'w1', detail: grades('tsv-text') })

    expect(await pending).toEqual({ ok: true, tsv: 'tsv-text' })
    expect(plugin.clearCookies).not.toHaveBeenCalled()
    expect(plugin.close).toHaveBeenCalledWith({ id: 'w1' })
  })

  it('reads once even though Schoology changes its address many times', async () => {
    const { plugin, emit } = fakePlugin()
    const pending = signInAndRead(deps(plugin), { fresh: false })
    await opened(plugin)
    for (let i = 0; i < 5; i++) emit('urlChangeEvent', { id: 'w1', url: `${SCHOOL}/home#/step${i}` })
    await vi.waitFor(() => expect(plugin.executeScript).toHaveBeenCalled())
    emit('messageFromWebview', { id: 'w1', detail: grades() })
    await pending
    expect(plugin.executeScript).toHaveBeenCalledTimes(1)
  })

  it('signs out first when asked to switch accounts', async () => {
    const { plugin, emit } = fakePlugin()
    const pending = signInAndRead(deps(plugin), { fresh: true })
    await opened(plugin)
    expect(plugin.clearCookies).toHaveBeenCalledWith({ url: SCHOOL })
    emit('messageFromWebview', { id: 'w1', detail: grades() })
    await pending
  })

  it('ignores lookalike sites, other windows, and messages that are not grades', async () => {
    const { plugin, emit } = fakePlugin()
    const pending = signInAndRead(deps(plugin, { timeoutMs: 50 }), { fresh: false })
    await opened(plugin)
    emit('urlChangeEvent', { id: 'w1', url: 'https://fuhsd.schoology.com.evil.example/home' })
    emit('urlChangeEvent', { id: 'other', url: `${SCHOOL}/home` })
    emit('messageFromWebview', { id: 'other', detail: grades('stolen') })
    emit('messageFromWebview', { id: 'w1', detail: { type: 'something-else' } })
    emit('messageFromWebview', { id: 'w1', detail: { type: GRADES_MESSAGE, version: 1, tsv: 5 } })
    expect(plugin.executeScript).not.toHaveBeenCalled()
    expect(await pending).toMatchObject({ ok: false }) // nothing valid ever arrived, so it times out
  })

  it('explains each reason the helper gives for not reading the grades', async () => {
    const expected: Record<string, string> = {
      'signed-out': 'signed out',
      layout: 'look different',
      network: 'internet connection',
      'no-classes': 'No classes were found',
      'wrong-site': "wasn't the Schoology page",
    }
    for (const [reason, text] of Object.entries(expected)) {
      const { plugin, emit } = fakePlugin()
      const pending = signInAndRead(deps(plugin), { fresh: false })
      await opened(plugin)
      emit('messageFromWebview', { id: 'w1', detail: { type: ERROR_MESSAGE, version: 1, reason } })
      const result = await pending
      expect(result).toMatchObject({ ok: false, message: expect.stringContaining(text) })
      expect(plugin.close).toHaveBeenCalled()
    }
  })

  it('reports a window closed before the grades were read as not finished', async () => {
    const { plugin, emit } = fakePlugin()
    const pending = signInAndRead(deps(plugin), { fresh: false })
    await opened(plugin)
    emit('closeEvent', { id: 'w1' })
    expect(await pending).toEqual({ ok: false, message: "Sign-in wasn't finished, so nothing was changed." })
  })

  it('gives up after the time limit', async () => {
    vi.useFakeTimers()
    const { plugin } = fakePlugin()
    const pending = signInAndRead(deps(plugin, { timeoutMs: 1000 }), { fresh: false })
    await vi.advanceTimersByTimeAsync(1001)
    expect(await pending).toMatchObject({ ok: false, message: expect.stringContaining("wasn't finished") })
    expect(plugin.close).toHaveBeenCalled()
  })

  it('reports it when the helper cannot be loaded or the window cannot be opened, and cleans up', async () => {
    const a = fakePlugin()
    const pendingA = signInAndRead(deps(a.plugin, { loadHelperCode: async () => { throw new Error('offline') } }), { fresh: false })
    await opened(a.plugin)
    a.emit('urlChangeEvent', { id: 'w1', url: `${SCHOOL}/home` })
    expect(await pendingA).toMatchObject({ ok: false, message: expect.stringContaining('internet connection') })

    const b = fakePlugin()
    b.plugin.openWebView.mockRejectedValue(new Error('no window'))
    expect(await signInAndRead(deps(b.plugin), { fresh: false })).toMatchObject({ ok: false, message: expect.stringContaining('open the Schoology sign-in window') })
    expect(Object.values(b.listeners).flat()).toHaveLength(0) // every listener was removed
  })

  it('removes its listeners when it finishes', async () => {
    const { plugin, emit, listeners } = fakePlugin()
    const pending = signInAndRead(deps(plugin), { fresh: false })
    await opened(plugin)
    emit('messageFromWebview', { id: 'w1', detail: grades() })
    await pending
    expect(Object.values(listeners).flat()).toHaveLength(0)
  })
})

describe('the phone app bridge', () => {
  const base = (): Synergy => ({
    status: vi.fn(), dashboard: vi.fn(), gradebook: vi.fn(), edits: vi.fn(), saveEdits: vi.fn(),
    sync: vi.fn(async () => ({ ok: false as const, message: 'web sync' })), signIn: vi.fn(), signOut: vi.fn(async () => ({ ok: true as const })),
    exportTsv: vi.fn(), openFolder: vi.fn(), deleteData: vi.fn(async () => ({ ok: true as const })),
    googleStatus: vi.fn(), googleConnect: vi.fn(), googleDisconnect: vi.fn(), calendar: vi.fn(), mail: vi.fn(), openExternal: vi.fn(),
    importGrades: vi.fn(async () => ({ ok: true as const, classes: 2, assignments: 9 })), platform: 'web', grabberLink: () => 'javascript:x',
  } as unknown as Synergy)

  it('says it is the phone app, without the website’s bookmark', () => {
    const bridge = createAppBridge(base(), deps(fakePlugin().plugin))
    expect(bridge.platform).toBe('app')
    expect(bridge.grabberLink).toBeUndefined()
  })

  it('signs in through the window and then loads the grades the same way an imported file is loaded', async () => {
    const { plugin, emit } = fakePlugin()
    const web = base()
    const bridge = createAppBridge(web, deps(plugin))
    const pending = bridge.signIn()
    await opened(plugin)
    expect(plugin.clearCookies).toHaveBeenCalled() // signing in again starts fresh
    emit('messageFromWebview', { id: 'w1', detail: grades('tsv-text') })
    expect(await pending).toEqual({ ok: true, classes: 2, assignments: 9 })
    expect(web.importGrades).toHaveBeenCalledWith('tsv-text')
  })

  it('refreshes without signing out first, and keeps the old grades when reading fails', async () => {
    const { plugin, emit } = fakePlugin()
    const web = base()
    const bridge = createAppBridge(web, deps(plugin))
    const pending = bridge.sync()
    await opened(plugin)
    expect(plugin.clearCookies).not.toHaveBeenCalled()
    emit('messageFromWebview', { id: 'w1', detail: { type: ERROR_MESSAGE, version: 1, reason: 'signed-out' } })
    expect(await pending).toMatchObject({ ok: false, message: expect.stringContaining('signed out') })
    expect(web.importGrades).not.toHaveBeenCalled()
  })

  it('clears the Schoology login on sign out and on Delete my data, but not when delete is cancelled', async () => {
    const { plugin } = fakePlugin()
    const web = base()
    const bridge = createAppBridge(web, deps(plugin))
    await bridge.signOut()
    expect(plugin.clearCookies).toHaveBeenCalledTimes(1)
    expect(web.signOut).toHaveBeenCalled()

    ;(web.deleteData as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, canceled: true })
    await bridge.deleteData()
    expect(plugin.clearCookies).toHaveBeenCalledTimes(1)
    await bridge.deleteData()
    expect(plugin.clearCookies).toHaveBeenCalledTimes(2)
  })

  it('shows Google as unavailable, and offers no file export or data folder', async () => {
    const bridge = createAppBridge(base(), deps(fakePlugin().plugin))
    expect(await bridge.googleStatus()).toEqual({ ok: true, configured: false, connected: false, email: null })
    expect((await bridge.exportTsv()).ok).toBe(false)
    expect((await bridge.openFolder()).ok).toBe(false)
  })
})
