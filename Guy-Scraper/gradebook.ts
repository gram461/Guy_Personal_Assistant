import type { CalcCategory, CalcClass, CalcItem } from './gradeCalc'
import { parseTsv, type TsvRow } from './tsv'

// One assignment, with what the window needs to show it and let the user change its score.
export type GradebookItem = CalcItem & {
  id: string
  // Pacific calendar date (YYYY-MM-DD) and 24-hour time (HH:MM), or null when Schoology gives none.
  dueDate: string | null
  dueTime: string | null
  // A written grade such as "Mastered", for work that has no points.
  gradeText: string | null
}

// One class in one term, with everything the grade page needs.
export type GradebookClass = Omit<CalcClass, 'items'> & {
  key: string
  teacher: string | null
  gradeLetter: string | null
  items: GradebookItem[]
}

export type Gradebook = { classes: GradebookClass[]; lastSyncedAt: string | null }

const orNull = (value: string) => (value === '' ? null : value)
const toNumber = (value: string) => (value === '' || !Number.isFinite(Number(value)) ? null : Number(value))

// What the grade page works from: each class in each term, its categories (even empty ones), and its work.
export function buildGradebook(tsv: string): Gradebook {
  const rows = parseTsv(tsv)
  const keyOf = (row: TsvRow) => `${row.term}|${row.class}|${row.teacher}`

  const classes = new Map<string, GradebookClass>()
  const termsPerClass = new Map<string, number>()
  for (const row of rows) {
    if (row.type !== 'class') continue
    const classKey = `${row.class}|${row.teacher}`
    termsPerClass.set(classKey, (termsPerClass.get(classKey) ?? 0) + 1)
    classes.set(keyOf(row), {
      key: keyOf(row),
      name: row.class,
      teacher: orNull(row.teacher),
      term: row.term,
      gradeLetter: orNull(row.class_grade_letter),
      reportedPercent: toNumber(row.class_grade_percent),
      categories: [],
      items: [],
    })
  }

  // The class grade covers every term, so it only describes a term's grade when the class has just one.
  for (const cls of classes.values()) {
    if ((termsPerClass.get(`${cls.name}|${cls.teacher ?? ''}`) ?? 0) > 1) cls.reportedPercent = null
  }

  for (const row of rows) {
    const cls = classes.get(keyOf(row))
    if (!cls) continue

    if (row.type === 'category') {
      if (row.category === '' || cls.categories.some(c => c.name === row.category)) continue
      const category: CalcCategory = { name: row.category, weight: toNumber(row.category_weight_percent), reportedPercent: toNumber(row.category_grade_percent) }
      cls.categories.push(category)
    }
  }

  for (const row of rows) {
    const cls = classes.get(keyOf(row))
    if (!cls || row.type !== 'assignment') continue

    // Files saved before categories were stored have them only on the assignments.
    if (row.category !== '' && !cls.categories.some(c => c.name === row.category)) {
      cls.categories.push({ name: row.category, weight: toNumber(row.category_weight_percent), reportedPercent: null })
    }
    cls.items.push({
      id: row.assignment_id,
      title: row.title,
      category: orNull(row.category),
      score: toNumber(row.score),
      maxPoints: toNumber(row.max_points),
      status: row.status,
      dueDate: orNull(row.due_date),
      dueTime: orNull(row.due_time),
      gradeText: orNull(row.grade_text),
    })
  }

  const stamps = rows.map(r => r.scraped_at).filter(Boolean).sort()
  return { classes: [...classes.values()], lastSyncedAt: stamps.at(-1) ?? null }
}
