import { describe, expect, it } from 'vitest'
import { buildGradebook } from '../gradebook'
import { calculateGrade } from '../gradeCalc'
import type { AssignmentSnapshot, SchoologySnapshot } from '../snapshot'
import { TSV_COLUMNS, buildGradesTsv, formatTsv, snapshotToRows } from '../tsv'

const assignment = (overrides: Partial<AssignmentSnapshot>): AssignmentSnapshot => ({
  periodId: 'p1', sectionId: 's1', assignmentId: '1', categoryId: 'c1', title: 'Lab', description: '',
  dueAt: null, dueAllDay: false, score: 8, maxPoints: 10, gradeText: null,
  status: 'graded', isLate: false, hasSubmission: false, ...overrides,
})

const snapshot: SchoologySnapshot = {
  gradingPeriods: [
    { periodId: 'p1', name: '26-27 T1', startsOn: '2026-07-01', endsOn: '2027-06-30' },
    { periodId: 'p2', name: '26-27 T2', startsOn: '2026-07-01', endsOn: '2027-06-30' },
  ],
  courses: [
    { periodId: 'p1', sectionId: 's1', name: 'Biology', teacherName: 'SmithJ', gradePercent: 80, gradeLetter: 'B-' },
    { periodId: 'p1', sectionId: 's2', name: 'History', teacherName: 'LeeK', gradePercent: 91, gradeLetter: 'A-' },
    { periodId: 'p2', sectionId: 's2', name: 'History', teacherName: 'LeeK', gradePercent: 91, gradeLetter: 'A-' },
  ],
  categories: [
    { periodId: 'p1', sectionId: 's1', categoryId: 'c1', name: 'Tests', weight: 80, gradePercent: 80 },
    { periodId: 'p1', sectionId: 's1', categoryId: 'c2', name: 'Final', weight: 20, gradePercent: null },
  ],
  assignments: [
    assignment({}),
    assignment({ assignmentId: '2', categoryId: 'c1', score: null, maxPoints: null, status: 'ungraded' }),
    assignment({ assignmentId: '3', periodId: 'p1', sectionId: 's2', categoryId: null, score: 9, maxPoints: 10 }),
  ],
}

const tsv = buildGradesTsv(snapshot, new Date('2026-11-04T12:00:00Z')).text

describe('buildGradebook', () => {
  it('lists each class in each term, with its teacher and Schoology grade', () => {
    const { classes } = buildGradebook(tsv)
    expect(classes.map(c => [c.name, c.term, c.teacher, c.gradeLetter])).toEqual([
      ['Biology', '26-27 T1', 'SmithJ', 'B-'],
      ['History', '26-27 T1', 'LeeK', 'A-'],
      ['History', '26-27 T2', 'LeeK', 'A-'],
    ])
    expect(new Set(classes.map(c => c.key)).size).toBe(3)
  })

  it('includes every category, even one with nothing graded yet, with its weight and Schoology grade', () => {
    const biology = buildGradebook(tsv).classes[0]
    expect(biology.categories).toEqual([
      { name: 'Tests', weight: 80, reportedPercent: 80 },
      { name: 'Final', weight: 20, reportedPercent: null },
    ])
  })

  it('includes the work, with its id, scores, points, status and due date', () => {
    const biology = buildGradebook(tsv).classes[0]
    expect(biology.items).toEqual([
      { id: '1', title: 'Lab', category: 'Tests', score: 8, maxPoints: 10, status: 'graded', dueDate: null, dueTime: null, gradeText: null },
      { id: '2', title: 'Lab', category: 'Tests', score: null, maxPoints: null, status: 'ungraded', dueDate: null, dueTime: null, gradeText: null },
    ])
  })

  it('carries due dates, times and written grades through', () => {
    const dated: SchoologySnapshot = {
      ...snapshot,
      assignments: [
        assignment({ assignmentId: '7', dueAt: '2026-11-06T07:59:00.000Z', dueAllDay: false }),
        assignment({ assignmentId: '8', dueAt: '2026-11-06T20:00:00.000Z', dueAllDay: true, score: null, maxPoints: null, gradeText: 'Mastered' }),
      ],
    }
    const items = buildGradebook(buildGradesTsv(dated, new Date('2026-11-04T12:00:00Z')).text).classes[0].items
    expect(items[0]).toMatchObject({ id: '7', dueDate: '2026-11-05', dueTime: '23:59' })
    expect(items[1]).toMatchObject({ id: '8', dueDate: '2026-11-06', dueTime: null, gradeText: 'Mastered' })
  })

  it("uses the class grade only when the class has a single term, since it covers every term", () => {
    const { classes } = buildGradebook(tsv)
    expect(classes[0].reportedPercent).toBe(80)
    expect(classes[1].reportedPercent).toBeNull()
    expect(classes[2].reportedPercent).toBeNull()
  })

  it('gives the calculator what it needs to match the grade on file', () => {
    const [biology, history] = buildGradebook(tsv).classes
    expect(calculateGrade(biology).percent).toBe(80)
    expect(calculateGrade(history).percent).toBe(90)
  })

  it('reports when the grades were saved', () => {
    expect(buildGradebook(tsv).lastSyncedAt).toBe('2026-11-04T12:00:00.000Z')
  })

  it('is empty for the shipped header-only file', () => {
    expect(buildGradebook(formatTsv([]))).toEqual({ classes: [], lastSyncedAt: null })
  })

  it('reads a file saved before categories were stored, taking them from the assignments', () => {
    const without = TSV_COLUMNS.indexOf('category_grade_percent')
    const rows = snapshotToRows(snapshot, new Date('2026-11-04T12:00:00Z')).filter(r => r.type !== 'category')
    const legacy = formatTsv(rows)
      .split('\n')
      .map(line => line.split('\t').filter((_, i) => i !== without).join('\t'))
      .join('\n')

    const biology = buildGradebook(legacy).classes[0]
    expect(biology.categories).toEqual([{ name: 'Tests', weight: 80, reportedPercent: null }])
    expect(calculateGrade(biology).percent).toBe(80)
  })
})
