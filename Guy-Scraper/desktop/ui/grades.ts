import { calculateEditedGrade, calculateGrade, type CalcClass, type CalcItem, type GradeResult } from '../../gradeCalc'
import type { GradebookClass, GradebookItem } from '../../gradebook'
import { MAX_ADDED_PER_CLASS, MAX_TITLE_LENGTH, type AddedAssignment, type SavedEdits } from '../../savedEdits'

// Everything here is plain functions on plain data, so the same code runs in the window and in the tests.

export const LARGEST = 1_000_000
export const UNWEIGHTED_CATEGORY = 'All assignments'

export type Parsed = { state: 'empty' } | { state: 'ok'; value: number } | { state: 'bad' }

export function parseNumber(text: string | null | undefined): Parsed {
  const trimmed = (text ?? '').trim()
  if (trimmed === '') return { state: 'empty' }
  // Number() accepts things like "0x10" and "1e3"; typed scores are plain decimals only.
  if (!/^\d*\.?\d+$|^\d+\.$/.test(trimmed)) return { state: 'bad' }
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0 && value <= LARGEST ? { state: 'ok', value } : { state: 'bad' }
}

export type RowKind =
  | 'normal' // a score can be typed
  | 'excused' // doesn't count, can't be changed
  | 'missing' // Schoology counts it as zero, shown as Missing
  | 'written' // a written grade like "Mastered": no points to change
  | 'added' // one the user added

export type Row = {
  // The key under SavedEdits.scores
  scoreKey: string
  // The key under SavedEdits.points (only for work whose points Schoology doesn't show)
  pointsKey: string | null
  title: string
  category: string | null
  dueDate: string | null
  dueTime: string | null
  kind: RowKind
  status: string
  gradeText: string | null
  scoreText: string
  originalScoreText: string
  score: Parsed
  // Points as text, from Schoology, or what the user filled in
  pointsText: string
  pointsEditable: boolean
  points: Parsed
  // True when the score or points differ from what Schoology showed
  edited: boolean
  waiting: boolean
  addedId: number | null
}

export type ClassView = {
  cls: GradebookClass
  rows: Row[]
  original: GradeResult
  current: GradeResult
  edited: boolean
  // False when Schoology gives this class only written grades and no percentage, so there is nothing to calculate from.
  // The grade shown is then Schoology's letter, and scores can't be changed here.
  recalculable: boolean
  // What "Add an assignment" offers
  categoryOptions: { value: string; label: string }[]
}

const addedKey = (id: number) => `add-${id}`
const sameNumberText = (a: string, b: string) => a.trim() === b.trim()

function rowFromItem(item: GradebookItem, edits: SavedEdits): Row {
  const scoreKey = item.id
  const originalScoreText = item.score === null ? '' : String(item.score)
  const base = {
    scoreKey,
    pointsKey: null,
    title: item.title,
    category: item.category,
    dueDate: item.dueDate,
    dueTime: item.dueTime,
    status: item.status,
    gradeText: item.gradeText,
    originalScoreText,
    addedId: null,
  }

  const untouchable = (kind: RowKind): Row => ({
    ...base,
    kind,
    scoreText: originalScoreText,
    score: parseNumber(originalScoreText),
    pointsText: item.maxPoints === null ? '' : String(item.maxPoints),
    pointsEditable: false,
    points: item.maxPoints === null ? { state: 'empty' } : { state: 'ok', value: item.maxPoints },
    edited: false,
    waiting: false,
  })

  if (item.status === 'excused') return untouchable('excused')
  if (item.status === 'missing') return untouchable('missing')
  if (item.gradeText !== null && item.maxPoints === null && item.score === null) return untouchable('written')

  const scoreText = Object.hasOwn(edits.scores, scoreKey) ? edits.scores[scoreKey] : originalScoreText
  const pointsEditable = item.maxPoints === null
  const typedPoints = pointsEditable && Object.hasOwn(edits.points, item.id) ? edits.points[item.id] : ''
  const pointsText = pointsEditable ? typedPoints : String(item.maxPoints)

  return {
    ...base,
    pointsKey: pointsEditable ? item.id : null,
    kind: 'normal',
    scoreText,
    score: parseNumber(scoreText),
    pointsText,
    pointsEditable,
    points: pointsEditable ? parseNumber(pointsText) : { state: 'ok', value: item.maxPoints as number },
    edited: !sameNumberText(scoreText, originalScoreText) || (pointsEditable && typedPoints.trim() !== ''),
    waiting: item.status === 'submitted' && originalScoreText === '',
  }
}

function rowFromAdded(added: AddedAssignment, edits: SavedEdits): Row {
  const scoreKey = addedKey(added.id)
  const scoreText = Object.hasOwn(edits.scores, scoreKey) ? edits.scores[scoreKey] : ''
  return {
    scoreKey,
    pointsKey: null,
    title: added.title,
    category: added.category,
    dueDate: null,
    dueTime: null,
    kind: 'added',
    status: 'ungraded',
    gradeText: null,
    scoreText,
    originalScoreText: '',
    score: parseNumber(scoreText),
    pointsText: String(added.points),
    pointsEditable: false,
    points: { state: 'ok', value: added.points },
    edited: false,
    waiting: false,
    addedId: added.id,
  }
}

// The item as the calculator should see it with the user's changes applied.
function calcItem(row: Row, original: GradebookItem | null): CalcItem {
  const keep = (): CalcItem =>
    original
      ? { title: original.title, category: original.category, score: original.score, maxPoints: original.maxPoints, status: original.status }
      : { title: row.title, category: row.category, score: null, maxPoints: row.points.state === 'ok' ? row.points.value : null, status: 'ungraded' }

  if (row.kind !== 'normal' && row.kind !== 'added') return keep()
  if (row.points.state !== 'ok') {
    // Points are unknown, so a typed score can't count yet. Clearing a graded score still works.
    return row.score.state === 'empty' ? { ...keep(), score: null, status: 'ungraded' } : keep()
  }

  const maxPoints = row.points.value
  if (row.score.state === 'ok') return { title: row.title, category: row.category, score: row.score.value, maxPoints, status: 'graded' }
  if (row.score.state === 'empty') return { title: row.title, category: row.category, score: null, maxPoints, status: 'ungraded' }
  return keep()
}

export function categoryOptions(cls: GradebookClass): { value: string; label: string }[] {
  const weighted = cls.categories.filter(c => c.weight !== null && c.weight > 0)
  if (weighted.length === 0) return [{ value: UNWEIGHTED_CATEGORY, label: UNWEIGHTED_CATEGORY }]
  return weighted.map(c => ({ value: c.name, label: `${c.name} (${c.weight}%)` }))
}

export function viewClass(cls: GradebookClass, edits: SavedEdits): ClassView {
  const added = (edits.added[cls.key] ?? []).map(a => rowFromAdded(a, edits))
  const fromSchoology = cls.items.map(item => rowFromItem(item, edits))
  const rows = [...added, ...fromSchoology]

  const original: CalcClass = cls
  const edited: CalcClass = {
    ...cls,
    items: [...fromSchoology.map((row, i) => calcItem(row, cls.items[i])), ...added.map(row => calcItem(row, null))],
  }

  const current = calculateEditedGrade(original, edited)
  const writtenGrades = cls.items.some(i => i.gradeText !== null && i.score === null)
  // With written grades and no percentage from Schoology, the few numeric items would stand in for the whole class.
  const recalculable = !(current.method === 'points' && cls.reportedPercent === null && cls.gradeLetter !== null && writtenGrades)

  return {
    cls,
    rows,
    recalculable,
    original: calculateGrade(original),
    current,
    edited: rows.some(r => r.edited || r.kind === 'added'),
    categoryOptions: categoryOptions(cls),
  }
}

// --- changing the saved edits (each returns a new object and never changes the one it was given) ---

export function setScoreText(edits: SavedEdits, row: Row, text: string): SavedEdits {
  const scores = { ...edits.scores }
  // Typing the original score back is the same as having no edit.
  if (row.kind !== 'added' && sameNumberText(text, row.originalScoreText)) delete scores[row.scoreKey]
  else scores[row.scoreKey] = text.trim()
  return { ...edits, scores }
}

export function setPointsText(edits: SavedEdits, row: Row, text: string): SavedEdits {
  if (row.pointsKey === null) return edits
  const points = { ...edits.points }
  if (text.trim() === '') delete points[row.pointsKey]
  else points[row.pointsKey] = text.trim()
  return { ...edits, points }
}

export type NewAssignment = { name: string; points: string; category: string }
export type NewAssignmentCheck = { ok: true; added: Omit<AddedAssignment, 'id'> } | { ok: false; nameTooLong: boolean; pointsBad: boolean; full: boolean }

export function checkNewAssignment(cls: GradebookClass, edits: SavedEdits, form: NewAssignment): NewAssignmentCheck {
  const points = parseNumber(form.points)
  const pointsBad = points.state !== 'ok' || points.value <= 0
  const nameTooLong = form.name.trim().length > MAX_TITLE_LENGTH
  const full = (edits.added[cls.key] ?? []).length >= MAX_ADDED_PER_CLASS
  if (pointsBad || nameTooLong || full) return { ok: false, nameTooLong, pointsBad, full }

  const options = categoryOptions(cls)
  const category = options.some(o => o.value === form.category) ? form.category : options[0].value
  return { ok: true, added: { title: form.name.trim() || 'New assignment', category, points: (points as { value: number }).value } }
}

export function addAssignment(cls: GradebookClass, edits: SavedEdits, added: Omit<AddedAssignment, 'id'>): SavedEdits {
  const every = Object.values(edits.added).flat()
  const id = Math.max(0, ...every.map(a => a.id)) + 1
  return { ...edits, added: { ...edits.added, [cls.key]: [{ id, ...added }, ...(edits.added[cls.key] ?? [])] } }
}

export function removeAssignment(cls: GradebookClass, edits: SavedEdits, id: number): SavedEdits {
  const scores = { ...edits.scores }
  delete scores[addedKey(id)]
  const remaining = (edits.added[cls.key] ?? []).filter(a => a.id !== id)
  const added = { ...edits.added }
  if (remaining.length > 0) added[cls.key] = remaining
  else delete added[cls.key]
  return { ...edits, scores, added }
}

// Puts one class back to what Schoology shows, leaving other classes alone.
export function resetClass(cls: GradebookClass, edits: SavedEdits): SavedEdits {
  const scores = { ...edits.scores }
  const points = { ...edits.points }
  for (const item of cls.items) {
    delete scores[item.id]
    delete points[item.id]
  }
  for (const a of edits.added[cls.key] ?? []) delete scores[addedKey(a.id)]
  const added = { ...edits.added }
  delete added[cls.key]
  return { scores, points, added }
}

// --- wording ---

const round2 = (v: number) => Math.round(v * 100) / 100
export const percentText = (v: number | null) => (v === null ? '-' : `${round2(v).toFixed(2)}%`)
export const pointsText = (v: number) => String(round2(v))

// Schoology adds the course number to the name: "Algebra 2 - 2310" is shown as "Algebra 2".
export const classTitle = (raw: string) => raw.replace(/\s+-\s+\d{3,5}$/, '')

// "NavarroK" becomes "K. Navarro"; anything that doesn't look like that is shown as it is.
export function teacherName(raw: string | null): string {
  if (!raw) return 'No teacher listed'
  const match = raw.match(/^([A-Z][a-z'’-]+(?:[A-Z][a-z'’-]+)*)([A-Z])$/)
  return match ? `${match[2]}. ${match[1]}` : raw
}
