import { describe, expect, it } from 'vitest'
import type { ScrapedAssignment } from '../parseAssignments'
import type { GradeCourse, GradeItem } from '../parseGrades'
import { pacificToIso, periodDates, toSnapshot } from '../toSnapshot'

const item = (overrides: Partial<GradeItem>): GradeItem => ({
  assignmentId: '1', periodId: '7', categoryId: '7-8', title: 'Lab', dueDate: '2026-11-05', dueTime: null,
  score: null, maxPoints: null, gradeText: null, status: 'ungraded', hasSubmission: false, ...overrides,
})

const course = (overrides: Partial<GradeCourse> = {}): GradeCourse => ({
  sectionId: '100', label: 'Biology - 1234: SmithJ p3 T1', courseName: 'Biology - 1234', teacher: 'SmithJ',
  gradePercent: 89, gradeLetter: 'B+',
  periods: [
    { periodId: '7', name: '26-27 T1', gradePercent: 89, gradeLetter: 'B+' },
    { periodId: '9', name: '26-27 T2', gradePercent: null, gradeLetter: null },
  ],
  categories: [
    { categoryId: '7-8', periodId: '7', name: 'Tests', weight: 35, gradePercent: 87.5 },
    { categoryId: '9-8', periodId: '9', name: 'Tests', weight: 35, gradePercent: null },
  ],
  items: [item({})],
  ...overrides,
})

const home = (overrides: Partial<ScrapedAssignment> = {}): ScrapedAssignment => ({
  assignmentId: '500', title: 'Retake', dueAt: '2026-11-05T23:59:59.000Z',
  courseLabel: 'Biology - 1234 : SmithJ p3 T1', courseName: 'Biology - 1234', teacher: 'SmithJ', ...overrides,
})

describe('toSnapshot', () => {
  it('stores a class only under terms that have work, with its overall average', () => {
    const snapshot = toSnapshot([course()], [])
    expect(snapshot.courses).toEqual([{ periodId: '7', sectionId: '100', name: 'Biology - 1234', teacherName: 'SmithJ', gradePercent: 89, gradeLetter: 'B+' }])
    expect(snapshot.categories.map(c => c.categoryId)).toEqual(['7-8'])
    expect(snapshot.categories[0]).toMatchObject({ name: 'Tests', weight: 35, gradePercent: 87.5 })
  })

  it('keeps classes that have no assignments yet', () => {
    expect(toSnapshot([course({ items: [] })], []).courses.map(c => c.periodId)).toEqual(['7'])
  })

  it('lists a term shared by several classes only once', () => {
    const snapshot = toSnapshot([course(), course({ sectionId: '200', items: [item({ assignmentId: '2' })] })], [])
    expect(snapshot.gradingPeriods.map(p => p.periodId)).toEqual(['7'])
    expect(snapshot.courses).toHaveLength(2)
  })

  it('adds assignments only the homepage lists, under the same class', () => {
    const [retake] = toSnapshot([course({ items: [] })], [home()]).assignments
    expect(retake).toMatchObject({ assignmentId: '500', sectionId: '100', periodId: '7', status: 'ungraded', dueAllDay: true })
  })

  it('prefers the grades page when an assignment is on both', () => {
    const snapshot = toSnapshot([course()], [home({ assignmentId: '1', title: 'Homepage title' })])
    expect(snapshot.assignments).toHaveLength(1)
    expect(snapshot.assignments[0].title).toBe('Lab')
  })

  it('carries grades, status and submissions through', () => {
    const [saved] = toSnapshot([course({ items: [item({ score: 9, maxPoints: 10, gradeText: 'A-', status: 'submitted', hasSubmission: true })] })], []).assignments
    expect(saved).toMatchObject({ score: 9, maxPoints: 10, gradeText: 'A-', status: 'submitted', hasSubmission: true })
  })

  it('does not invent a time for assignments with no due time', () => {
    const [noTime] = toSnapshot([course()], []).assignments
    expect(noTime.dueAllDay).toBe(true)
    expect(new Date(noTime.dueAt!).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })).toBe('2026-11-05')
    expect(toSnapshot([course({ items: [item({ dueDate: null })] })], []).assignments[0]).toMatchObject({ dueAt: null, dueAllDay: false })
    expect(toSnapshot([course({ items: [] })], [home({ dueAt: '2026-11-06T16:30:00.000Z' })]).assignments[0].dueAllDay).toBe(false)
  })

  it('converts due times from Pacific time, including across daylight saving', () => {
    const timed = (dueDate: string, dueTime: string) => toSnapshot([course({ items: [item({ dueDate, dueTime })] })], []).assignments[0].dueAt
    expect(timed('2026-11-05', '11:59pm')).toBe('2026-11-06T07:59:00.000Z')
    expect(timed('2026-09-07', '11:59pm')).toBe('2026-09-08T06:59:00.000Z')
    expect(timed('2026-11-06', '8:30am')).toBe('2026-11-06T16:30:00.000Z')
    expect(timed('2026-11-06', '12:15am')).toBe('2026-11-06T08:15:00.000Z')
    expect(timed('2026-11-06', '12:15pm')).toBe('2026-11-06T20:15:00.000Z')
    expect(pacificToIso('2026-11-06', 12, 0)).toBe('2026-11-06T20:00:00.000Z')
  })
})

describe('periodDates', () => {
  it('uses the school year in the term name', () => {
    expect(periodDates('26-27 T1')).toEqual({ startsOn: '2026-07-01', endsOn: '2027-06-30' })
  })

  it('falls back to the current school year', () => {
    expect(periodDates('Sandbox', new Date('2026-11-03T12:00:00Z'))).toEqual({ startsOn: '2026-07-01', endsOn: '2027-06-30' })
    expect(periodDates('Sandbox', new Date('2027-02-03T12:00:00Z'))).toEqual({ startsOn: '2026-07-01', endsOn: '2027-06-30' })
  })
})
