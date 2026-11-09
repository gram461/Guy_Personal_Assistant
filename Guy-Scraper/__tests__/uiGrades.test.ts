import { describe, expect, it } from 'vitest'
import type { GradebookClass, GradebookItem } from '../gradebook'
import { emptyEdits, type SavedEdits } from '../savedEdits'
import {
  addAssignment, checkNewAssignment, classTitle, parseNumber, removeAssignment, resetClass, setPointsText, setScoreText, teacherName, viewClass,
} from '../desktop/ui/grades'

const item = (overrides: Partial<GradebookItem>): GradebookItem => ({
  id: '1', title: 'Lab', category: 'Tests', score: 8, maxPoints: 10, status: 'graded', dueDate: null, dueTime: null, gradeText: null, ...overrides,
})

const biology = (items: GradebookItem[], overrides: Partial<GradebookClass> = {}): GradebookClass => ({
  key: 'T1|Biology|SmithJ', name: 'Biology', term: 'T1', teacher: 'SmithJ', gradeLetter: 'B', reportedPercent: null,
  categories: [{ name: 'Tests', weight: 70, reportedPercent: 80 }, { name: 'Homework', weight: 30, reportedPercent: 100 }],
  items, ...overrides,
})

const items = [
  item({ id: '1', score: 8, maxPoints: 10 }),
  item({ id: '2', score: 8, maxPoints: 10 }),
  item({ id: '3', category: 'Homework', score: 10, maxPoints: 10 }),
  item({ id: '4', category: 'Homework', score: null, maxPoints: null, status: 'ungraded' }),
]
const cls = biology(items)

describe('parseNumber', () => {
  it('accepts plain numbers and nothing else', () => {
    expect(parseNumber('42')).toEqual({ state: 'ok', value: 42 })
    expect(parseNumber(' 7.5 ')).toEqual({ state: 'ok', value: 7.5 })
    expect(parseNumber('.5')).toEqual({ state: 'ok', value: 0.5 })
    expect(parseNumber('0')).toEqual({ state: 'ok', value: 0 })
    expect(parseNumber('')).toEqual({ state: 'empty' })
    expect(parseNumber('   ')).toEqual({ state: 'empty' })
    for (const bad of ['abc', '-3', '1e3', '0x10', '1,5', '2000000', 'Infinity', '5 5']) expect(parseNumber(bad)).toEqual({ state: 'bad' })
  })
})

describe('viewClass', () => {
  it('matches the starting grade when nothing is changed', () => {
    const view = viewClass(cls, emptyEdits())
    expect(view.current).toEqual(view.original)
    expect(view.edited).toBe(false)
    expect(view.rows.map(r => r.kind)).toEqual(['normal', 'normal', 'normal', 'normal'])
  })

  it('moves the grade when a score is typed, and says it was edited', () => {
    const edits = setScoreText(emptyEdits(), viewClass(cls, emptyEdits()).rows[0], '10')
    const view = viewClass(cls, edits)
    expect(view.edited).toBe(true)
    expect(view.rows[0]).toMatchObject({ scoreText: '10', edited: true })
    expect(view.current.categories[0].percent).toBe(90)
    expect(view.original.categories[0].percent).toBe(80)
  })

  it('needs the points before a score for ungraded work counts, and lets the user fill them in', () => {
    const start = viewClass(cls, emptyEdits())
    const ungraded = start.rows[3]
    expect(ungraded).toMatchObject({ pointsEditable: true, pointsKey: '4' })

    const scoreOnly = viewClass(cls, setScoreText(emptyEdits(), ungraded, '5'))
    expect(scoreOnly.current).toEqual(start.original)

    const both = viewClass(cls, setPointsText(setScoreText(emptyEdits(), ungraded, '5'), ungraded, '10'))
    expect(both.current.categories[1]).toMatchObject({ earned: 15, possible: 20, percent: 75 })
    expect(both.rows[3].edited).toBe(true)
  })

  it('lets a graded score be cleared', () => {
    const view = viewClass(cls, setScoreText(emptyEdits(), viewClass(cls, emptyEdits()).rows[0], ''))
    expect(view.current.categories[0]).toMatchObject({ earned: 8, possible: 10, percent: 80 })
    expect(view.rows[0].edited).toBe(true)
  })

  it('treats typing the original score back as no edit', () => {
    const row = viewClass(cls, emptyEdits()).rows[0]
    const edits = setScoreText(setScoreText(emptyEdits(), row, '10'), row, '8')
    expect(edits).toEqual(emptyEdits())
  })

  it('ignores a score that is not a number but flags it', () => {
    const row = viewClass(cls, emptyEdits()).rows[0]
    const view = viewClass(cls, setScoreText(emptyEdits(), row, 'abc'))
    expect(view.rows[0].score.state).toBe('bad')
    expect(view.current).toEqual(view.original)
  })

  it('keeps excused, missing and written-grade work out of reach', () => {
    const work = biology([
      item({ id: '1', status: 'excused', score: null, maxPoints: null }),
      item({ id: '2', status: 'missing', score: null, maxPoints: null }),
      item({ id: '3', status: 'graded', score: null, maxPoints: null, gradeText: 'Mastered' }),
    ])
    const view = viewClass(work, emptyEdits())
    expect(view.rows.map(r => [r.kind, r.pointsEditable])).toEqual([['excused', false], ['missing', false], ['written', false]])
  })

  it('shows added assignments first, counts them, and lets them be removed', () => {
    let edits = addAssignment(cls, emptyEdits(), { title: 'Unit 4 test', category: 'Tests', points: 50 })
    const added = viewClass(cls, edits).rows[0]
    expect(added).toMatchObject({ kind: 'added', title: 'Unit 4 test', pointsText: '50', addedId: 1 })
    expect(viewClass(cls, edits).edited).toBe(true)

    edits = setScoreText(edits, added, '45')
    const view = viewClass(cls, edits)
    expect(view.current.categories[0]).toMatchObject({ earned: 61, possible: 70 })

    edits = removeAssignment(cls, edits, 1)
    expect(edits).toEqual(emptyEdits())
    expect(viewClass(cls, edits).current).toEqual(viewClass(cls, edits).original)
  })

  it('gives new ids that never repeat, even across classes', () => {
    const other = biology([], { key: 'T1|Chem|Lee' })
    let edits = addAssignment(cls, emptyEdits(), { title: 'a', category: 'Tests', points: 1 })
    edits = addAssignment(other, edits, { title: 'b', category: 'Tests', points: 1 })
    edits = removeAssignment(cls, edits, 1)
    edits = addAssignment(cls, edits, { title: 'c', category: 'Tests', points: 1 })
    expect(edits.added[cls.key][0].id).toBe(3)
  })

  it('offers one choice for a class without weighted categories', () => {
    const plain = biology(items, { categories: [] })
    expect(viewClass(plain, emptyEdits()).categoryOptions).toEqual([{ value: 'All assignments', label: 'All assignments' }])
    const edits = addAssignment(plain, emptyEdits(), { title: 'x', category: 'All assignments', points: 10 })
    const view = viewClass(plain, setScoreText(edits, viewClass(plain, edits).rows[0], '10'))
    expect(view.current.method).toBe('points')
    expect(view.current.percent).toBeGreaterThan(view.original.percent as number)
  })

  it('does not change the saved edits it is given', () => {
    const edits: SavedEdits = { scores: { '1': '10' }, points: {}, added: {} }
    const copy = structuredClone(edits)
    viewClass(cls, edits)
    setScoreText(edits, viewClass(cls, edits).rows[1], '3')
    expect(edits).toEqual(copy)
  })
})

describe('checkNewAssignment', () => {
  const form = { name: '  Unit 4 test ', points: '50', category: 'Tests' }

  it('accepts a good one and tidies the name', () => {
    expect(checkNewAssignment(cls, emptyEdits(), form)).toEqual({ ok: true, added: { title: 'Unit 4 test', category: 'Tests', points: 50 } })
  })

  it('names a nameless one and falls back to the first category when the choice is unknown', () => {
    expect(checkNewAssignment(cls, emptyEdits(), { name: '', points: '5', category: 'Nope' })).toEqual({ ok: true, added: { title: 'New assignment', category: 'Tests', points: 5 } })
  })

  it('refuses bad points, long names and too many', () => {
    for (const points of ['', '0', 'x', '-5']) expect(checkNewAssignment(cls, emptyEdits(), { ...form, points })).toMatchObject({ ok: false, pointsBad: true })
    expect(checkNewAssignment(cls, emptyEdits(), { ...form, name: 'x'.repeat(61) })).toMatchObject({ ok: false, nameTooLong: true })
    const many = { ...emptyEdits(), added: { [cls.key]: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, title: 't', category: 'Tests', points: 1 })) } }
    expect(checkNewAssignment(cls, many, form)).toMatchObject({ ok: false, full: true })
  })
})

describe('resetClass', () => {
  it('clears one class and leaves the others', () => {
    const edits: SavedEdits = { scores: { '1': '10', '4': '5', 'add-1': '3', '900': '2' }, points: { '4': '10', '901': '4' }, added: { [cls.key]: [{ id: 1, title: 'x', category: 'Tests', points: 5 }], other: [{ id: 2, title: 'y', category: 'A', points: 5 }] } }
    expect(resetClass(cls, edits)).toEqual({ scores: { '900': '2' }, points: { '901': '4' }, added: { other: [{ id: 2, title: 'y', category: 'A', points: 5 }] } })
  })
})

describe('teacherName', () => {
  it('turns the code into a name', () => {
    expect(teacherName('NavarroK')).toBe('K. Navarro')
    expect(teacherName('SmithJ')).toBe('J. Smith')
    expect(teacherName('McDonaldJ')).toBe('J. McDonald')
    expect(teacherName('Mr. Reyes')).toBe('Mr. Reyes')
    expect(teacherName(null)).toBe('No teacher listed')
  })
})

describe('classes graded with written letters', () => {
  const lettered = biology(
    [
      item({ id: '1', category: 'Homework', score: 5, maxPoints: 5 }),
      item({ id: '2', category: 'Homework', score: null, maxPoints: null, gradeText: 'A' }),
      item({ id: '3', category: 'Homework', score: null, maxPoints: null, gradeText: 'B' }),
    ],
    { categories: [], gradeLetter: 'A', reportedPercent: null },
  )

  it("can't be recalculated when Schoology gives only a letter", () => {
    expect(viewClass(lettered, emptyEdits()).recalculable).toBe(false)
  })

  it('can be recalculated when Schoology gives a percentage, or there are no written grades', () => {
    expect(viewClass({ ...lettered, reportedPercent: 95 }, emptyEdits()).recalculable).toBe(true)
    expect(viewClass(biology(items), emptyEdits()).recalculable).toBe(true)
    expect(viewClass(biology(items, { categories: [], gradeLetter: 'A', reportedPercent: null }), emptyEdits()).recalculable).toBe(true)
  })
})

describe('classTitle', () => {
  it('drops the course number Schoology adds', () => {
    expect(classTitle('Algebra 2 - 2310')).toBe('Algebra 2')
    expect(classTitle('World Lit/Writ - 1020')).toBe('World Lit/Writ')
    expect(classTitle('HHS Hub')).toBe('HHS Hub')
    expect(classTitle('Unit 4 - Review')).toBe('Unit 4 - Review')
  })
})
