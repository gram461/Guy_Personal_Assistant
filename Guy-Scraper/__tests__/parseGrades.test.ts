import { describe, expect, it } from 'vitest'
import { ScraperLayoutError } from '../errors'
import { parseGrades } from '../parseGrades'

const item = (id: string, parent: string, title: string, gradeCell: string, due = '<span class="due-date"><span class="visually-hidden">Due </span>9/17/26</span>') => `
  <tr data-id="I-${id}" data-parent-id="${parent}" class="report-row item-row">
    <th class="title-column"><span class="title"><a href="https://fuhsd.schoology.com/assignment/${id}">${title}<span class="visually-hidden">assignment</span></a></span> ${due}</th>
    <td class="grade-column"><div class="td-content-wrapper">${gradeCell}<div class="grade-wrapper"></div></div></td>
  </tr>`

const PENDING = '<span class="no-grade">—</span><span class="has-dropbox-icon grade-pending-icon"><span class="visually-hidden">This student has made a submission that has not been graded.</span></span>'

const page = (rows: string) => `
  <div class="gradebook-course" id="s-js-gradebook-course-100">
    <div class="gradebook-course-title"><a href="#" aria-expanded="false"><span class="arrow"></span>Biology - 1234: SmithJ p3 T1<span class="visually-hidden">Course</span></a></div>
    <div class="gradebook-course-grades"><table><tbody>
      <tr data-id="100" class="report-row course-row"><th><span class="title">Course Grade</span></th>
        <td class="grade-column"><span class="awarded-grade"><span class="alpha-grade primary-grade">B+</span> <span class="numeric-grade secondary-grade">(<span class="rounded-grade" title="89%">89%</span>)</span></span></td></tr>
      <tr data-id="7" data-parent-id="100" class="report-row period-row"><th><span class="title">26-27 T1<span class="visually-hidden">Grading Period</span></span></th>
        <td class="grade-column"><span class="awarded-grade"><span class="alpha-grade primary-grade">A-</span> (<span class="rounded-grade" title="91%">91%</span>)</span></td></tr>
      <tr data-id="7-8" data-parent-id="7" class="report-row category-row"><th><span class="title">Tests<span class="visually-hidden">Category</span></span> <span class="percentage-contrib">(35%)</span></th>
        <td class="grade-column"><span class="awarded-grade"><span class="alpha-grade">B+</span> (<span class="rounded-grade" title="87.5%">87.5%</span>)</span></td></tr>
      ${rows}
    </tbody></table></div>
  </div>`

const only = (rows: string) => parseGrades(page(rows))[0].items[0]

describe('parseGrades', () => {
  it('reads the class, teacher, average, periods and categories', () => {
    const [course] = parseGrades(page(''))
    expect(course).toMatchObject({
      sectionId: '100',
      courseName: 'Biology - 1234',
      teacher: 'SmithJ',
      gradePercent: 89,
      gradeLetter: 'B+',
      periods: [{ periodId: '7', name: '26-27 T1', gradePercent: 91, gradeLetter: 'A-' }],
      categories: [{ categoryId: '7-8', periodId: '7', name: 'Tests', weight: 35, gradePercent: 87.5 }],
    })
  })

  it('reads a class average shown as a bare letter', () => {
    const html = page('').replace(/<td class="grade-column"><span class="awarded-grade"><span class="alpha-grade primary-grade">B\+<\/span>[\s\S]*?<\/td>/, '<td class="grade-column"><span class="awarded-grade">A</span></td>')
    expect(parseGrades(html)[0]).toMatchObject({ gradeLetter: 'A', gradePercent: null })
  })

  it('reads a graded assignment with points', () => {
    expect(only(item('1', '7-8', 'Unit Test', '<span class="awarded-grade"><span class="rounded-grade" title="90.5">90.5</span></span><span class="max-grade"> / 100</span>'))).toEqual({
      assignmentId: '1', periodId: '7', categoryId: '7-8', title: 'Unit Test',
      dueDate: '2026-09-17', dueTime: null,
      score: 90.5, maxPoints: 100, gradeText: null, status: 'graded', hasSubmission: false,
    })
  })

  it('keeps letter and written grades', () => {
    expect(only(item('1', '7-8', 'A', '<span class="awarded-grade">A- <span class="numeric-grade-value"><span class="rounded-grade" title="9">9</span></span></span><span class="max-grade"> / 10</span>'))).toMatchObject({ gradeText: 'A-', score: 9, maxPoints: 10, status: 'graded' })
    expect(only(item('1', '7-8', 'B', '<span class="awarded-grade">Mastered: Strong evidence</span>'))).toMatchObject({ gradeText: 'Mastered: Strong evidence', score: null, status: 'graded' })
  })

  it('treats the blue square as submitted, even over an old grade', () => {
    expect(only(item('1', '7-8', 'A', PENDING))).toMatchObject({ status: 'submitted', hasSubmission: true, score: null })
    expect(only(item('1', '7-8', 'B', `<span class="awarded-grade"><span class="rounded-grade" title="5">5</span></span><span class="max-grade"> / 10</span>${PENDING}`))).toMatchObject({ status: 'submitted', score: 5 })
  })

  it('reads missing, excused and not-yet-graded assignments', () => {
    expect(only(item('1', '7-8', 'A', '<div class="exception-grade-wrapper"><span class="no-grade">0</span><span class="exception"><span class="exception-icon missing"></span><span class="exception-text">Missing</span></span></div>'))).toMatchObject({ status: 'missing', score: 0 })
    expect(only(item('1', '7-8', 'B', '<div class="exception-grade-wrapper"><span class="no-grade">—</span><span class="exception"><span class="exception-icon excused"></span><span class="exception-text">Exempt</span></span></div>'))).toMatchObject({ status: 'excused', score: null })
    expect(only(item('1', '7-8', 'C', '<span class="no-grade">—</span>'))).toMatchObject({ status: 'ungraded', score: null, maxPoints: null })
  })

  it('reads due times, missing due dates, and rows with no category', () => {
    const timed = '<span class="due-date"><span class="visually-hidden">Due </span>9/7/26 11:59pm</span>'
    expect(only(item('1', '7', 'A', '<span class="no-grade">—</span>', timed))).toMatchObject({ dueDate: '2026-09-07', dueTime: '11:59pm', categoryId: null, periodId: '7' })
    expect(only(item('1', '7-8', 'B', '<span class="no-grade">—</span>', ''))).toMatchObject({ dueDate: null, dueTime: null })
  })

  it('fails loudly instead of losing assignments when the layout changes', () => {
    expect(() => parseGrades('<div>Please log in</div>')).toThrow(ScraperLayoutError)
    expect(() => parseGrades(page(item('1', 'unknown-parent', 'A', '<span class="no-grade">—</span>')))).toThrow(ScraperLayoutError)
    expect(() => parseGrades(page(item('1', '7-8', 'A', '<span class="exception-icon incomplete"></span>')))).toThrow(ScraperLayoutError)
  })
})
