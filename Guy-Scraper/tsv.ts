import path from 'node:path'
import { atomicWriteFile } from './atomicWrite'
import { DataUnreadableError } from './errors'
import type { SchoologySnapshot } from './snapshot'

const PACIFIC_TZ = 'America/Los_Angeles'

// Shipped with the program as a header-only file; the scraper fills it in on the user's own computer.
export const DEFAULT_GRADES_PATH = path.join(__dirname, 'data', 'grades.tsv')

export const TSV_COLUMNS = [
  'type',
  'term',
  'class',
  'teacher',
  'class_grade_letter',
  'class_grade_percent',
  'category',
  'category_weight_percent',
  'category_grade_percent',
  'assignment_id',
  'title',
  'due_date',
  'due_time',
  'status',
  'score',
  'max_points',
  'grade_text',
  'submitted_online',
  'scraped_at',
] as const

type Column = (typeof TSV_COLUMNS)[number]
export type TsvRow = Record<Column, string>

const blankRow = (): TsvRow => Object.fromEntries(TSV_COLUMNS.map(c => [c, ''])) as TsvRow

// Tabs and newlines would break the columns. A leading = + - or @ would run as a formula when the file is opened in a spreadsheet.
function text(value: string | null): string {
  const flat = (value ?? '').replace(/[\t\r\n]+/g, ' ').trim()
  return /^[=+\-@]/.test(flat) ? `'${flat}` : flat
}

function number(value: number | null): string {
  return value === null ? '' : String(Math.round(value * 100) / 100)
}

// Category grades feed the calculator, so they keep more decimals than the grades shown on screen.
function precise(value: number | null): string {
  return value === null ? '' : String(Math.round(value * 10000) / 10000)
}

function pacificDueParts(dueAt: string | null, allDay: boolean): { date: string; time: string } {
  if (!dueAt) return { date: '', time: '' }
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) throw new Error('An assignment has an unreadable due date')
  const date = due.toLocaleDateString('en-CA', { timeZone: PACIFIC_TZ })
  if (allDay) return { date, time: '' }
  const time = due.toLocaleTimeString('en-GB', { timeZone: PACIFIC_TZ, hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

export function snapshotToRows(snapshot: SchoologySnapshot, scrapedAt: Date): TsvRow[] {
  const stamp = scrapedAt.toISOString()
  const termName = (periodId: string) => snapshot.gradingPeriods.find(p => p.periodId === periodId)?.name ?? ''
  const classOrder = [...snapshot.courses].sort((a, b) => a.name.localeCompare(b.name) || a.periodId.localeCompare(b.periodId))

  const rows: TsvRow[] = []
  for (const course of classOrder) {
    rows.push({
      ...blankRow(),
      type: 'class',
      term: text(termName(course.periodId)),
      class: text(course.name),
      teacher: text(course.teacherName),
      class_grade_letter: text(course.gradeLetter),
      class_grade_percent: number(course.gradePercent),
      scraped_at: stamp,
    })

    // Every category is listed, even one with nothing graded yet, so the calculator can offer it.
    for (const category of snapshot.categories.filter(c => c.sectionId === course.sectionId && c.periodId === course.periodId)) {
      rows.push({
        ...blankRow(),
        type: 'category',
        term: text(termName(course.periodId)),
        class: text(course.name),
        teacher: text(course.teacherName),
        category: text(category.name),
        category_weight_percent: number(category.weight),
        category_grade_percent: precise(category.gradePercent),
        scraped_at: stamp,
      })
    }

    const assignments = snapshot.assignments
      .filter(a => a.sectionId === course.sectionId && a.periodId === course.periodId)
      .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.title.localeCompare(b.title))

    for (const a of assignments) {
      const category = snapshot.categories.find(c => c.categoryId === a.categoryId && c.sectionId === course.sectionId)
      const due = pacificDueParts(a.dueAt, a.dueAllDay)
      rows.push({
        type: 'assignment',
        term: text(termName(course.periodId)),
        class: text(course.name),
        teacher: text(course.teacherName),
        class_grade_letter: '',
        class_grade_percent: '',
        category: text(category?.name ?? null),
        category_weight_percent: number(category?.weight ?? null),
        category_grade_percent: '',
        assignment_id: a.assignmentId,
        title: text(a.title),
        due_date: due.date,
        due_time: due.time,
        status: a.status,
        score: number(a.score),
        max_points: number(a.maxPoints),
        grade_text: text(a.gradeText),
        submitted_online: a.hasSubmission ? 'yes' : 'no',
        scraped_at: stamp,
      })
    }
  }
  return rows
}

export function formatTsv(rows: TsvRow[]): string {
  const lines = [TSV_COLUMNS.join('\t'), ...rows.map(row => TSV_COLUMNS.map(c => row[c]).join('\t'))]
  return lines.join('\n') + '\n'
}

// Columns added after the first version. A file saved before they existed is still readable, with these left blank.
const NEWER_COLUMNS: readonly Column[] = ['category_grade_percent']

// Reads back what formatTsv wrote, undoing the quote that text() puts in front of formula characters.
export function parseTsv(content: string): TsvRow[] {
  const [header, ...lines] = content.split('\n').filter(line => line.length > 0)
  const names = (header ?? '').split('\t')
  const known = new Set<string>(TSV_COLUMNS)
  const hasEveryColumn = TSV_COLUMNS.every(c => NEWER_COLUMNS.includes(c) || names.includes(c))
  if (!hasEveryColumn || names.some(name => !known.has(name))) {
    throw new DataUnreadableError('The grades file has unexpected columns. Use Delete my data to start over.')
  }

  return lines.map(line => {
    const cells = line.split('\t')
    const row = blankRow()
    names.forEach((name, i) => {
      const cell = cells[i] ?? ''
      row[name as Column] = /^'[=+\-@]/.test(cell) ? cell.slice(1) : cell
    })
    return row
  })
}

export type GradesTsv = { text: string; classes: number; assignments: number }

export function buildGradesTsv(snapshot: SchoologySnapshot, scrapedAt = new Date()): GradesTsv {
  const rows = snapshotToRows(snapshot, scrapedAt)
  return {
    text: formatTsv(rows),
    classes: rows.filter(r => r.type === 'class').length,
    assignments: rows.filter(r => r.type === 'assignment').length,
  }
}

export async function writeGradesFile(
  filePath: string,
  snapshot: SchoologySnapshot,
  scrapedAt = new Date(),
): Promise<{ classes: number; assignments: number }> {
  const { text: content, classes, assignments } = buildGradesTsv(snapshot, scrapedAt)
  await atomicWriteFile(filePath, content)
  return { classes, assignments }
}
