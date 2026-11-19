import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SchoologySnapshot } from '@/Guy-Scraper/snapshot'
import { buildGradesTsv, formatTsv } from '@/Guy-Scraper/tsv'

const session = vi.hoisted(() => ({ current: null as null | { user: { email: string } } }))
vi.mock('next-auth/react', () => ({
  getSession: async () => session.current,
  signIn: vi.fn(),
  signOut: vi.fn(async () => {}),
}))

// A tiny stand-in for the browser: storage, a confirm box, and window.open.
const store = new Map<string, string>()
const open = vi.fn()
let confirmAnswer = true
vi.stubGlobal('window', {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  confirm: () => confirmAnswer,
  open,
})

const { webBridge } = await import('@/components/synergy/webBridge')

const snapshot: SchoologySnapshot = {
  gradingPeriods: [{ periodId: 'p1', name: '26-27 T1', startsOn: '2026-07-01', endsOn: '2027-06-30' }],
  courses: [{ periodId: 'p1', sectionId: 's1', name: 'Biology - 1234', teacherName: 'SmithJ', gradePercent: 80, gradeLetter: 'B-' }],
  categories: [{ periodId: 'p1', sectionId: 's1', categoryId: 'c1', name: 'Tests', weight: 100, gradePercent: 80 }],
  assignments: [
    { periodId: 'p1', sectionId: 's1', assignmentId: '1', categoryId: 'c1', title: 'Lab', description: '', dueAt: '2026-11-06T20:00:00.000Z', dueAllDay: true, score: 8, maxPoints: 10, gradeText: null, status: 'graded', isLate: false, hasSubmission: false },
  ],
}
const goodFile = buildGradesTsv(snapshot, new Date('2026-11-04T12:00:00Z')).text

beforeEach(() => {
  store.clear()
  open.mockReset()
  confirmAnswer = true
  session.current = null
})

describe('web bridge: grades kept in the browser', () => {
  it('says it is the website, and starts with no grades', async () => {
    expect(webBridge.platform).toBe('web')
    expect(await webBridge.status()).toMatchObject({ ok: true, classes: 0, assignments: 0, signedIn: false, dataFolder: 'This browser' })
    expect(await webBridge.gradebook()).toMatchObject({ ok: true, classes: [] })
  })

  it('loads an exported file, keeps it, and shows it', async () => {
    expect(await webBridge.importGrades!(goodFile)).toEqual({ ok: true, classes: 1, assignments: 1 })
    expect(store.get('synergy-web-grades')).toBe(goodFile)
    const status = await webBridge.status()
    expect(status).toMatchObject({ ok: true, classes: 1, assignments: 1, signedIn: true, lastSyncedAt: '2026-11-04T12:00:00.000Z' })
    const book = await webBridge.gradebook()
    expect(book.ok && book.classes[0]).toMatchObject({ name: 'Biology - 1234', gradeLetter: 'B-' })
  })

  it('refuses files that are not grades files, and keeps what it had', async () => {
    await webBridge.importGrades!(goodFile)
    for (const bad of ['not a grades file', 'type\tterm\n1\t2\n', '', formatTsv([])]) {
      expect((await webBridge.importGrades!(bad)).ok).toBe(false)
    }
    expect(store.get('synergy-web-grades')).toBe(goodFile)
  })

  it('refuses a file that is far too large', async () => {
    const result = await webBridge.importGrades!('x'.repeat(5 * 1024 * 1024 + 1))
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('too large') })
  })

  it('treats a damaged stored file as no grades instead of breaking the screens', async () => {
    store.set('synergy-web-grades', 'garbage')
    expect(await webBridge.gradebook()).toMatchObject({ ok: true, classes: [] })
    expect((await webBridge.status())).toMatchObject({ signedIn: false })
  })

  it('keeps the scores the person typed, cleaned, and returns what it kept', async () => {
    const saved = await webBridge.saveEdits({ scores: { '1': '10', bad: 5 }, points: {}, added: {} } as never)
    expect(saved).toMatchObject({ ok: true, edits: { scores: { '1': '10' }, points: {}, added: {} } })
    expect(await webBridge.edits()).toMatchObject({ ok: true, edits: { scores: { '1': '10' } } })
    store.set('synergy-web-edits', '{not json')
    expect(await webBridge.edits()).toMatchObject({ ok: true, edits: { scores: {}, points: {}, added: {} } })
  })

  it('removes the grades and edits from the browser on sign out', async () => {
    await webBridge.importGrades!(goodFile)
    await webBridge.saveEdits({ scores: { '1': '9' }, points: {}, added: {} })
    await webBridge.signOut()
    expect(store.size).toBe(0)
  })

  it('has no Schoology sign-in or data folder to offer', async () => {
    expect((await webBridge.sync()).ok).toBe(false)
    expect((await webBridge.signIn()).ok).toBe(false)
    expect((await webBridge.openFolder()).ok).toBe(false)
  })
})

describe('web bridge: delete and Google', () => {
  it('does nothing when the person cancels, and erases the browser data when they agree', async () => {
    await webBridge.importGrades!(goodFile)
    store.set('synergy-name', 'Alex')
    confirmAnswer = false
    expect(await webBridge.deleteData()).toEqual({ ok: false, canceled: true })
    expect(store.size).toBe(2)

    confirmAnswer = true
    expect(await webBridge.deleteData()).toEqual({ ok: true })
    expect(store.size).toBe(0)
  })

  it('deletes the account data on the server first when signed in, and keeps everything if that fails', async () => {
    session.current = { user: { email: 'me@school.example' } }
    await webBridge.importGrades!(goodFile)
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await webBridge.deleteData()).toMatchObject({ ok: false })
    expect(store.size).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/account-data', { method: 'DELETE' })

    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    expect(await webBridge.deleteData()).toEqual({ ok: true })
    expect(store.size).toBe(0)
  })

  it('reports Google as connected only when signed in, with the account email', async () => {
    expect(await webBridge.googleStatus()).toEqual({ ok: true, configured: true, connected: false, email: null })
    session.current = { user: { email: 'me@school.example' } }
    expect(await webBridge.googleStatus()).toEqual({ ok: true, configured: true, connected: true, email: 'me@school.example' })
  })

  it('asks the server for calendar and mail, passing along a "sign in again" answer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, events: [{ id: 'e' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, message: 'Google needs you to sign in again.', reconnect: true }), { status: 401 }))
      .mockRejectedValueOnce(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    expect(await webBridge.calendar('2026-11-09T00:00:00.000Z', '2026-11-16T00:00:00.000Z')).toEqual({ ok: true, events: [{ id: 'e' }] })
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/synergy/calendar?from=2026-11-09T00%3A00%3A00.000Z&to=2026-11-16T00%3A00%3A00.000Z')
    expect(await webBridge.mail()).toEqual({ ok: false, message: 'Google needs you to sign in again.', reconnect: true })
    expect(await webBridge.mail()).toMatchObject({ ok: false, message: expect.stringContaining('could not be reached') })
  })

  it('opens only the person’s own Google pages', async () => {
    expect((await webBridge.openExternal('https://mail.google.com/mail/u/0/#inbox/abc')).ok).toBe(true)
    expect((await webBridge.openExternal('https://calendar.google.com/')).ok).toBe(true)
    expect(open).toHaveBeenCalledTimes(2)
    for (const url of ['https://evil.example/', 'http://mail.google.com/', 'javascript:alert(1)', 'https://mail.google.com.evil.example/']) {
      expect((await webBridge.openExternal(url)).ok).toBe(false)
    }
    expect(open).toHaveBeenCalledTimes(2)
  })
})
