import { describe, expect, it } from 'vitest'
import { ScraperLayoutError } from '../errors'
import { parseAssignments, parseCourseLabel } from '../parseAssignments'

const row = (id: string, title: string, start: number, label: string, kind = 'assignment') => `
  <div class="upcoming-event upcoming-event-block course-event" data-start="${start}">
    <div class="upcoming-item-content"><span class="infotip">
      <span class="event-title"><a href="https://fuhsd.schoology.com/${kind}/${id}${kind === 'event' ? '/profile' : ''}">${title} </a>
        <span><span class="infotip-content"><div class="realm-main-titles">
          <span class="realm-title-course"><span class="realm-icon"></span>${label}</span>
        </div></span></span>
      </span>
    </span></div>
  </div>`

const page = (rows: string) => `<div class="upcoming-submissions-wrapper"><div class="upcoming-list">${rows}</div></div>`

describe('parseCourseLabel', () => {
  it('separates the class from the teacher', () => {
    expect(parseCourseLabel('Biology - 1234 : SmithJ p3 T1')).toEqual({ courseName: 'Biology - 1234', teacher: 'SmithJ' })
    expect(parseCourseLabel('Study Hall - 9100: DoeA pCTut')).toEqual({ courseName: 'Study Hall - 9100', teacher: 'DoeA' })
  })

  it('leaves the teacher empty when the label has none', () => {
    expect(parseCourseLabel('School Hub : Gr10')).toEqual({ courseName: 'School Hub', teacher: null })
  })
})

describe('parseAssignments', () => {
  it('reads the title, due date, class and teacher', () => {
    const [assignment] = parseAssignments(page(row('111', 'Lab 1', 1793663999, 'Biology - 1234 : SmithJ p3 T1')))
    expect(assignment).toEqual({
      assignmentId: '111',
      title: 'Lab 1',
      dueAt: new Date(1793663999 * 1000).toISOString(),
      courseLabel: 'Biology - 1234 : SmithJ p3 T1',
      courseName: 'Biology - 1234',
      teacher: 'SmithJ',
    })
  })

  it('skips calendar events and de-duplicates assignments', () => {
    const rows = parseAssignments(page(
      row('111', 'Lab 1', 1793663999, 'Biology : SmithJ p3') +
      row('111', 'Lab 1', 1793663999, 'Biology : SmithJ p3') +
      row('222', 'Assembly', 1793663999, 'School Hub : Gr10', 'event'),
    ))
    expect(rows.map(r => r.assignmentId)).toEqual(['111'])
  })

  it('includes rows the page hides to shorten its list', () => {
    const shown = row('111', 'Shown', 1793663999, 'Biology : SmithJ p3')
    const hidden = row('222', 'Hidden', 1793663999, 'Biology : SmithJ p3').replace('upcoming-event ', 'upcoming-event hidden-important ')
    expect(parseAssignments(page(shown + hidden)).map(r => r.title)).toEqual(['Shown', 'Hidden'])
  })

  it('treats an empty response as no assignments', () => {
    expect(parseAssignments('')).toEqual([])
    expect(parseAssignments(page(''))).toEqual([])
  })

  it('fails loudly when the layout changes instead of saving nothing', () => {
    expect(() => parseAssignments('<div>Please log in</div>')).toThrow(ScraperLayoutError)
    expect(() => parseAssignments(page('<div class="upcoming-event" data-start="1"><a href="/assignment/1">x</a></div>'))).toThrow(ScraperLayoutError)
  })
})

