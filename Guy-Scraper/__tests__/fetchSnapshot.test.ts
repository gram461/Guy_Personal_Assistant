import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScraperLayoutError, SessionExpiredError } from '../errors'
import { fetchSnapshot } from '../fetchSnapshot'

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

function stubSchoology(responses: Record<string, Response>) {
  const fetchMock = vi.fn(async (url: string) => {
    const response = responses[new URL(url).pathname]
    if (!response) throw new Error(`Unexpected request: ${url}`)
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchSnapshot', () => {
  it('combines the grades page with assignments only the homepage lists', async () => {
    const fetchMock = stubSchoology({
      '/home/overdue_submissions_ajax': new Response(ajax('')),
      '/home/upcoming_submissions_ajax': new Response(ajax(homepageRow('1', 'Cell Lab') + homepageRow('500', 'Retake'))),
      '/grades/grades': new Response(gradesPage),
    })

    const snapshot = await fetchSnapshot('SESS=abc', { delayMs: 0 })

    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/home/overdue_submissions_ajax',
      '/home/upcoming_submissions_ajax',
      '/grades/grades',
    ])
    expect(snapshot.courses).toMatchObject([{ name: 'Biology - 1234', teacherName: 'SmithJ', gradePercent: 93, gradeLetter: 'A' }])
    expect(snapshot.assignments.map(a => [a.assignmentId, a.title, a.status]).sort()).toEqual([
      ['1', 'Cell Lab', 'graded'],
      ['500', 'Retake', 'ungraded'],
    ])
  })

  it('returns nothing when Schoology asks for a new sign-in', async () => {
    stubSchoology({
      '/home/overdue_submissions_ajax': new Response(null, { status: 302 }),
    })
    await expect(fetchSnapshot('SESS=old', { delayMs: 0 })).rejects.toThrow(SessionExpiredError)
  })

  it('returns nothing when a page has an unexpected layout', async () => {
    stubSchoology({
      '/home/overdue_submissions_ajax': new Response(ajax('')),
      '/home/upcoming_submissions_ajax': new Response(ajax('')),
      '/grades/grades': new Response('<html>Please log in</html>'),
    })
    await expect(fetchSnapshot('SESS=abc', { delayMs: 0 })).rejects.toThrow(ScraperLayoutError)
  })
})
