import { describe, expect, it } from 'vitest'
import { buildDashboard } from '../dashboard'
import { DataUnreadableError } from '../errors'
import type { AssignmentSnapshot, SchoologySnapshot } from '../snapshot'
import { buildGradesTsv, formatTsv, parseTsv, snapshotToRows } from '../tsv'

const NOW = new Date('2026-11-04T20:00:00Z')

const assignment = (overrides: Partial<AssignmentSnapshot>): AssignmentSnapshot => ({
  periodId: 'p1', sectionId: 's1', assignmentId: '1', categoryId: null, title: 'Lab', description: '',
  dueAt: '2026-11-06T07:59:00.000Z', dueAllDay: false, score: null, maxPoints: null, gradeText: null,
  status: 'ungraded', isLate: false, hasSubmission: false, ...overrides,
})

const snapshot = (assignments: AssignmentSnapshot[]): SchoologySnapshot => ({
  gradingPeriods: [
    { periodId: 'p1', name: '26-27 T1', startsOn: '2026-07-01', endsOn: '2027-06-30' },
    { periodId: 'p2', name: '26-27 T2', startsOn: '2026-07-01', endsOn: '2027-06-30' },
  ],
  courses: [
    { periodId: 'p1', sectionId: 's1', name: 'Biology', teacherName: 'SmithJ', gradePercent: 92.456, gradeLetter: 'A' },
    { periodId: 'p2', sectionId: 's1', name: 'Biology', teacherName: 'SmithJ', gradePercent: 92.456, gradeLetter: 'A' },
    { periodId: 'p1', sectionId: 's2', name: 'Advisory', teacherName: null, gradePercent: null, gradeLetter: null },
  ],
  categories: [],
  assignments,
})

const tsvOf = (assignments: AssignmentSnapshot[]) => buildGradesTsv(snapshot(assignments), NOW).text

describe('parseTsv', () => {
  it('reads back exactly what was written, including text that was quoted to stop spreadsheet formulas', () => {
    const rows = snapshotToRows(snapshot([assignment({ title: '=SUM(A1)' }), assignment({ assignmentId: '2', title: '-5 pts' })]), NOW)
    const parsed = parseTsv(formatTsv(rows))
    expect(parsed.filter(r => r.type === 'assignment').map(r => r.title).sort()).toEqual(['-5 pts', '=SUM(A1)'])
    expect(parsed.filter(r => r.type === 'class')).toEqual(rows.filter(r => r.type === 'class'))
  })

  it('reads the shipped header-only file as no rows', () => {
    expect(parseTsv(formatTsv([]))).toEqual([])
  })

  it('refuses a file whose columns are not the ones this version writes', () => {
    expect(() => parseTsv('type\tclass\nclass\tBiology\n')).toThrow(DataUnreadableError)
  })
})

describe('buildDashboard', () => {
  it('lists each class once with its grade, even when it has rows in more than one term', () => {
    const { classes } = buildDashboard(tsvOf([]), NOW)
    expect(classes).toEqual([
      { name: 'Advisory', teacher: null, term: '26-27 T1', gradeLetter: null, gradePercent: null },
      { name: 'Biology', teacher: 'SmithJ', term: '26-27 T1', gradeLetter: 'A', gradePercent: 92.46 },
    ])
  })

  it('keeps the Pacific due date and time, and marks work with no time as all day', () => {
    const { assignments } = buildDashboard(
      tsvOf([assignment({}), assignment({ assignmentId: '2', title: 'Essay', dueAt: '2026-11-09T20:00:00.000Z', dueAllDay: true })]),
      NOW,
    )
    expect(assignments).toEqual([
      { uid: '1', title: 'Lab', className: 'Biology', dueDate: '2026-11-05', dueAt: '2026-11-06T07:59:00.000Z', allDay: false, status: 'ungraded' },
      { uid: '2', title: 'Essay', className: 'Biology', dueDate: '2026-11-09', dueAt: '2026-11-09T20:00:00.000Z', allDay: true, status: 'ungraded' },
    ])
  })

  it('shows only open work due from two weeks ago to a month ahead, earliest first', () => {
    const { assignments } = buildDashboard(
      tsvOf([
        assignment({ assignmentId: 'later', dueAt: '2026-11-20T20:00:00.000Z' }),
        assignment({ assignmentId: 'missing', status: 'missing', dueAt: '2026-10-28T20:00:00.000Z' }),
        assignment({ assignmentId: 'graded', status: 'graded', score: 9, maxPoints: 10 }),
        assignment({ assignmentId: 'submitted', status: 'submitted' }),
        assignment({ assignmentId: 'too-old', dueAt: '2026-10-01T20:00:00.000Z' }),
        assignment({ assignmentId: 'too-far', dueAt: '2027-01-15T20:00:00.000Z' }),
        assignment({ assignmentId: 'undated', dueAt: null }),
      ]),
      NOW,
    )
    expect(assignments.map(a => a.uid)).toEqual(['missing', 'later'])
  })

  it('reports when the data was last synced, or null before the first sync', () => {
    expect(buildDashboard(tsvOf([]), NOW).lastSyncedAt).toBe(NOW.toISOString())
    expect(buildDashboard(formatTsv([]), NOW)).toEqual({ classes: [], assignments: [], lastSyncedAt: null })
  })
})
