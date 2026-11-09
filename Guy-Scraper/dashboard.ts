import type { AssignmentStatus } from './snapshot'
import { pacificToIso } from './toSnapshot'
import { parseTsv } from './tsv'

const PACIFIC_TZ = 'America/Los_Angeles'
const DAY_MS = 24 * 60 * 60 * 1000
const LOOK_BACK_DAYS = 14
const LOOK_AHEAD_DAYS = 30
const OPEN_STATUSES = new Set<string>(['ungraded', 'missing'])

export type DashboardClass = {
  name: string
  teacher: string | null
  term: string
  gradeLetter: string | null
  gradePercent: number | null
}

export type DashboardAssignment = {
  uid: string
  title: string
  className: string
  // Pacific calendar date, so "due today" doesn't depend on the computer's time zone.
  dueDate: string
  dueAt: string
  allDay: boolean
  status: AssignmentStatus
}

export type Dashboard = {
  classes: DashboardClass[]
  assignments: DashboardAssignment[]
  lastSyncedAt: string | null
}

const pacificDateKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: PACIFIC_TZ })
const orNull = (value: string) => (value === '' ? null : value)

// What the desktop dashboard shows: each class once with its grade, and open work due around now.
export function buildDashboard(tsv: string, now = new Date()): Dashboard {
  const rows = parseTsv(tsv)
  const earliest = pacificDateKey(new Date(now.getTime() - LOOK_BACK_DAYS * DAY_MS))
  const latest = pacificDateKey(new Date(now.getTime() + LOOK_AHEAD_DAYS * DAY_MS))

  // A class with work in more than one term has a row per term, all carrying the same overall grade.
  const classes = new Map<string, DashboardClass>()
  for (const row of rows) {
    if (row.type !== 'class') continue
    const key = `${row.class}|${row.teacher}`
    if (classes.has(key)) continue
    classes.set(key, {
      name: row.class,
      teacher: orNull(row.teacher),
      term: row.term,
      gradeLetter: orNull(row.class_grade_letter),
      gradePercent: row.class_grade_percent === '' ? null : Number(row.class_grade_percent),
    })
  }

  const assignments: DashboardAssignment[] = []
  for (const row of rows) {
    if (row.type !== 'assignment' || !OPEN_STATUSES.has(row.status) || !row.due_date) continue
    if (row.due_date < earliest || row.due_date > latest) continue

    const time = row.due_time.match(/^(\d{2}):(\d{2})$/)
    assignments.push({
      uid: row.assignment_id,
      title: row.title,
      className: row.class,
      dueDate: row.due_date,
      dueAt: time ? pacificToIso(row.due_date, Number(time[1]), Number(time[2])) : pacificToIso(row.due_date, 12, 0),
      allDay: !time,
      status: row.status as AssignmentStatus,
    })
  }
  assignments.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title))

  const stamps = rows.map(r => r.scraped_at).filter(Boolean).sort()
  return { classes: [...classes.values()], assignments, lastSyncedAt: stamps.at(-1) ?? null }
}
