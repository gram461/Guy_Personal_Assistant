import { mkdir, mkdtemp, readFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AssignmentSnapshot, SchoologySnapshot } from '../snapshot'
import { DEFAULT_GRADES_PATH, TSV_COLUMNS, formatTsv, snapshotToRows, writeGradesFile } from '../tsv'

const assignment = (overrides: Partial<AssignmentSnapshot>): AssignmentSnapshot => ({
  periodId: 'p1', sectionId: 's1', assignmentId: '1', categoryId: 'c1', title: 'Lab', description: '',
  dueAt: '2026-11-06T07:59:00.000Z', dueAllDay: false, score: 9, maxPoints: 10, gradeText: null,
  status: 'graded', isLate: false, hasSubmission: true, ...overrides,
})

const snapshot = (assignments: AssignmentSnapshot[] = [assignment({})]): SchoologySnapshot => ({
  gradingPeriods: [{ periodId: 'p1', name: '26-27 T1', startsOn: '2026-07-01', endsOn: '2027-06-30' }],
  courses: [
    { periodId: 'p1', sectionId: 's1', name: 'Biology', teacherName: 'SmithJ', gradePercent: 92.456, gradeLetter: 'A' },
    { periodId: 'p1', sectionId: 's2', name: 'Advisory', teacherName: null, gradePercent: null, gradeLetter: null },
  ],
  categories: [
    { periodId: 'p1', sectionId: 's1', categoryId: 'c1', name: 'Tests', weight: 35, gradePercent: 87.33333333 },
    { periodId: 'p1', sectionId: 's1', categoryId: 'c2', name: 'Final', weight: 20, gradePercent: null },
  ],
  assignments,
})

const NOW = new Date('2026-11-04T12:00:00Z')

describe('the shipped grades.tsv', () => {
  it('contains only the header row, so real grades are never committed', async () => {
    expect(await readFile(DEFAULT_GRADES_PATH, 'utf8')).toBe(formatTsv([]))
  })
})

describe('snapshotToRows', () => {
  it('writes one row per class, category and assignment, with the class average on the class row', () => {
    const rows = snapshotToRows(snapshot(), NOW)
    expect(rows.map(r => `${r.type}:${r.class}`)).toEqual(['class:Advisory', 'class:Biology', 'category:Biology', 'category:Biology', 'assignment:Biology'])
    expect(rows[1]).toMatchObject({ term: '26-27 T1', teacher: 'SmithJ', class_grade_letter: 'A', class_grade_percent: '92.46', title: '' })
    expect(rows[0]).toMatchObject({ teacher: '', class_grade_letter: '', class_grade_percent: '' })
  })

  it('lists every category with its weight and Schoology grade, even one with nothing graded yet', () => {
    const [, , tests, final] = snapshotToRows(snapshot(), NOW)
    expect(tests).toMatchObject({ type: 'category', term: '26-27 T1', teacher: 'SmithJ', category: 'Tests', category_weight_percent: '35', category_grade_percent: '87.3333', assignment_id: '' })
    expect(final).toMatchObject({ category: 'Final', category_weight_percent: '20', category_grade_percent: '' })
  })

  it('writes each assignment with its grade, category, status and Pacific due date and time', () => {
    const row = snapshotToRows(snapshot(), NOW)[4]
    expect(row).toMatchObject({
      type: 'assignment', category: 'Tests', category_weight_percent: '35', assignment_id: '1', title: 'Lab',
      due_date: '2026-11-05', due_time: '23:59', status: 'graded', score: '9', max_points: '10',
      grade_text: '', submitted_online: 'yes', scraped_at: NOW.toISOString(),
    })
  })

  it('leaves the time blank for all-day work and everything blank when there is no due date', () => {
    const [, , , , allDay, none] = snapshotToRows(snapshot([
      assignment({ assignmentId: '2', dueAt: '2026-11-06T20:00:00.000Z', dueAllDay: true }),
      assignment({ assignmentId: '3', dueAt: null, categoryId: null, score: null, maxPoints: null, status: 'ungraded', hasSubmission: false }),
    ]), NOW)
    expect(allDay).toMatchObject({ due_date: '2026-11-06', due_time: '' })
    expect(none).toMatchObject({ due_date: '', due_time: '', category: '', score: '', max_points: '', status: 'ungraded', submitted_online: 'no' })
  })

  it('lists assignments by due date, with undated ones last', () => {
    const rows = snapshotToRows(snapshot([
      assignment({ assignmentId: '1', dueAt: null }),
      assignment({ assignmentId: '2', dueAt: '2026-11-09T20:00:00.000Z' }),
      assignment({ assignmentId: '3', dueAt: '2026-11-02T20:00:00.000Z' }),
    ]), NOW)
    expect(rows.filter(r => r.type === 'assignment').map(r => r.assignment_id)).toEqual(['3', '2', '1'])
  })

  it('keeps tabs and newlines out of fields and defuses spreadsheet formulas in text, but not negative numbers', () => {
    const [, , , , row] = snapshotToRows(snapshot([
      assignment({ title: '=HYPERLINK("http://example.com","x")', gradeText: 'Line1\n\tLine2', score: -5 }),
    ]), NOW)
    expect(row.title).toBe(`'=HYPERLINK("http://example.com","x")`)
    expect(row.grade_text).toBe('Line1 Line2')
    expect(row.score).toBe('-5')
    for (const title of ['+1', '-2', '@x']) {
      expect(snapshotToRows(snapshot([assignment({ title })]), NOW)[4].title).toBe(`'${title}`)
    }
  })
})

describe('formatTsv', () => {
  it('gives every line the same number of columns', () => {
    const lines = formatTsv(snapshotToRows(snapshot([assignment({ title: 'A\tB' })]), NOW)).trimEnd().split('\n')
    expect(lines).toHaveLength(6)
    for (const line of lines) expect(line.split('\t')).toHaveLength(TSV_COLUMNS.length)
  })
})

describe('writeGradesFile', () => {
  it('replaces the whole file, leaves no temp file behind, and keeps it private', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tsv-test-'))
    const file = path.join(dir, 'nested', 'grades.tsv')

    expect(await writeGradesFile(file, snapshot(), NOW)).toEqual({ classes: 2, assignments: 1 })
    expect((await readFile(file, 'utf8')).trimEnd().split('\n')).toHaveLength(6)

    expect(await writeGradesFile(file, snapshot([]), NOW)).toEqual({ classes: 2, assignments: 0 })
    expect((await readFile(file, 'utf8')).trimEnd().split('\n')).toHaveLength(5)

    expect(await readdir(path.dirname(file))).toEqual(['grades.tsv'])
    expect((await stat(file)).mode & 0o077).toBe(0)
  })

  it('leaves the previous file untouched when the write fails', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tsv-test-'))
    const file = path.join(dir, 'grades.tsv')
    await writeGradesFile(file, snapshot(), NOW)
    const before = await readFile(file, 'utf8')

    const broken = { ...snapshot(), assignments: [assignment({ dueAt: 'not a date' })] }
    await expect(writeGradesFile(file, broken, NOW)).rejects.toThrow('unreadable due date')
    expect(await readFile(file, 'utf8')).toBe(before)
    expect(await readdir(dir)).toEqual(['grades.tsv'])
  })

  it('cleans up its temp file when the file cannot be replaced', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tsv-test-'))
    const blocker = path.join(dir, 'grades.tsv')
    await mkdir(path.join(blocker, 'inside'), { recursive: true })

    await expect(writeGradesFile(blocker, snapshot(), NOW)).rejects.toThrow()
    expect(await readdir(dir)).toEqual(['grades.tsv'])
  })
})
