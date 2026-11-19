import { describe, expect, it, vi } from 'vitest'
import { createPageClient } from '../browser/pageClient'
import { GRADES_MESSAGE, MAX_TSV_CHARS, RECEIVED_MESSAGE, readGradesMessage, readReceivedMessage } from '../browser/messages'
import { ScraperLayoutError, SessionExpiredError } from '../errors'
import { scrapeSnapshot } from '../scrapeSnapshot'
import { buildGradesTsv } from '../tsv'

const homepageRow = (id: string, title: string) => `
  <div class="upcoming-event course-event" data-start="1793818200">
    <span class="event-title"><a href="https://fuhsd.schoology.com/assignment/${id}">${title}</a>
      <span class="infotip-content"><span class="realm-title-course">Biology - 1234 : SmithJ p3 T1</span></span>
    </span>
  </div>`
const ajax = (rows: string) => JSON.stringify({ html: `<div class="upcoming-list">${rows}</div>` })
const gradesPage = `
  <div class="gradebook-course" id="s-js-gradebook-course-100">
    <div class="gradebook-course-title"><a href="#"><span class="arrow"></span>Biology - 1234: SmithJ p3 T1</a></div>
    <table><tbody>
      <tr data-id="100" class="report-row course-row"><th><span class="title">Course Grade</span></th>
        <td class="grade-column"><span class="awarded-grade"><span class="alpha-grade">A</span> (<span class="rounded-grade" title="93%">93%</span>)</span></td></tr>
      <tr data-id="7" data-parent-id="100" class="report-row period-row"><th><span class="title">26-27 T1</span></th><td class="grade-column"></td></tr>
      <tr data-id="I-1" data-parent-id="7" class="report-row item-row">
        <th><span class="title"><a href="https://fuhsd.schoology.com/assignment/1">Cell Lab</a></span> <span class="due-date">Due 9/17/26</span></th>
        <td class="grade-column"><span class="awarded-grade"><span class="rounded-grade" title="9">9</span></span><span class="max-grade"> / 10</span></td></tr>
    </tbody></table>
  </div>`

const page = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, type: 'basic', json: async () => JSON.parse(body), text: async () => body })

function schoology(routes: Record<string, ReturnType<typeof page>>) {
  return vi.fn(async (path: string) => {
    const res = routes[path]
    if (!res) throw new Error(`Unexpected request: ${path}`)
    return res
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

const good = () => schoology({
  '/home/overdue_submissions_ajax': page(ajax(homepageRow('9', 'Late essay'))),
  '/home/upcoming_submissions_ajax': page(ajax(homepageRow('8', 'Quiz'))),
  '/grades/grades': page(gradesPage),
})

describe('reading Schoology from inside its own tab', () => {
  it('makes the same three requests as the desktop app, same-site and with the tab’s own login', async () => {
    const fetchMock = good()
    await scrapeSnapshot(createPageClient({ fetchImpl: fetchMock, delayMs: 0 }))
    const calls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.map(c => c[0])).toEqual(['/home/overdue_submissions_ajax', '/home/upcoming_submissions_ajax', '/grades/grades'])
    for (const [, init] of calls) {
      expect(init.credentials).toBe('same-origin')
      expect(init.redirect).toBe('manual')
      expect(init.headers.Cookie).toBeUndefined() // a page can't set cookies by hand, and never reads them
    }
    expect(calls[0][1].headers['X-Requested-With']).toBe('XMLHttpRequest')
  })

  it('produces the same grades file the desktop app would', async () => {
    const snapshot = await scrapeSnapshot(createPageClient({ fetchImpl: good(), delayMs: 0 }))
    const { text, classes, assignments } = buildGradesTsv(snapshot, new Date('2026-11-04T12:00:00Z'))
    expect(classes).toBe(1)
    expect(assignments).toBeGreaterThanOrEqual(1)
    expect(text).toContain('Biology - 1234')
    expect(text).toContain('Cell Lab')
  })

  it('waits between requests, as the desktop app does', async () => {
    vi.useFakeTimers()
    const fetchMock = good()
    const done = scrapeSnapshot(createPageClient({ fetchImpl: fetchMock, delayMs: 1000 }))
    await vi.advanceTimersByTimeAsync(0)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1000)
    await done
    vi.useRealTimers()
  })

  it('says signed out for a redirect to login, 401 or 403', async () => {
    for (const res of [{ ok: false, status: 0, type: 'opaqueredirect' }, { ok: false, status: 302, type: 'basic' }, page('', 401), page('', 403)]) {
      const fetchMock = vi.fn(async () => res) as unknown as typeof fetch
      await expect(scrapeSnapshot(createPageClient({ fetchImpl: fetchMock, delayMs: 0 }))).rejects.toThrow(SessionExpiredError)
    }
  })

  it('reports pages that are not in the expected format, and other failures, without half-reading', async () => {
    const odd = schoology({ '/home/overdue_submissions_ajax': { ...page('{}'), json: async () => ({ nothing: true }) } as never })
    await expect(scrapeSnapshot(createPageClient({ fetchImpl: odd, delayMs: 0 }))).rejects.toThrow(ScraperLayoutError)

    const broken = schoology({ '/home/overdue_submissions_ajax': page('', 500) })
    await expect(scrapeSnapshot(createPageClient({ fetchImpl: broken, delayMs: 0 }))).rejects.toThrow('HTTP 500')
  })

  it('refuses a path that is not on the school site', async () => {
    const client = createPageClient({ fetchImpl: good(), delayMs: 0 })
    await expect(client.getPage('https://evil.example/')).rejects.toThrow('relative')
  })
})

describe('the messages between the two tabs', () => {
  it('accepts exactly the grades message, within the size limit', () => {
    expect(readGradesMessage({ type: GRADES_MESSAGE, version: 1, tsv: 'a\tb\n' })).toEqual({ type: GRADES_MESSAGE, version: 1, tsv: 'a\tb\n' })
    for (const bad of [null, 'text', {}, { type: GRADES_MESSAGE, version: 2, tsv: 'x' }, { type: 'other', version: 1, tsv: 'x' }, { type: GRADES_MESSAGE, version: 1, tsv: 5 }, { type: GRADES_MESSAGE, version: 1, tsv: '' }, { type: GRADES_MESSAGE, version: 1, tsv: 'x'.repeat(MAX_TSV_CHARS + 1) }]) {
      expect(readGradesMessage(bad)).toBeNull()
    }
  })

  it('reads a reply, and trims a long message', () => {
    expect(readReceivedMessage({ type: RECEIVED_MESSAGE, ok: true, classes: 2, assignments: 9 })).toMatchObject({ ok: true, classes: 2, assignments: 9 })
    expect(readReceivedMessage({ type: RECEIVED_MESSAGE, ok: false, message: 'x'.repeat(1000) })?.message).toHaveLength(300)
    expect(readReceivedMessage({ type: RECEIVED_MESSAGE })).toBeNull()
    expect(readReceivedMessage('nope')).toBeNull()
  })
})
