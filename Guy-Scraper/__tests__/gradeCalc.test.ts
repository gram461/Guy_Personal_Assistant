import { describe, expect, it } from 'vitest'
import { calculateEditedGrade, calculateGrade, type CalcCategory, type CalcClass, type CalcItem } from '../gradeCalc'

const item = (score: number | null, maxPoints: number | null, category: string | null = null, status = 'graded'): CalcItem => ({
  title: 'Work', category, score, maxPoints, status,
})

const category = (name: string, weight: number | null, reportedPercent: number | null = null): CalcCategory => ({ name, weight, reportedPercent })

const classOf = (overrides: Partial<CalcClass> = {}): CalcClass => ({
  name: 'Biology', term: '26-27 T1', reportedPercent: null, categories: [], items: [], ...overrides,
})

const weighted = (items: CalcItem[], extra: Partial<CalcClass> = {}) =>
  classOf({ categories: [category('Tests', 60), category('Homework', 40)], items, ...extra })

// The same class with some work replaced, the way the grade page does when the user types a score.
const withItems = (cls: CalcClass, items: CalcItem[]): CalcClass => ({ ...cls, items })

describe('a class graded by total points', () => {
  it('adds up points earned over points possible', () => {
    expect(calculateGrade(classOf({ items: [item(9, 10), item(18, 20)] }))).toMatchObject({ method: 'points', percent: 90, counted: 2 })
  })

  it('has no grade until something is graded', () => {
    expect(calculateGrade(classOf()).percent).toBeNull()
    expect(calculateGrade(classOf({ items: [item(null, 10, null, 'ungraded')] })).percent).toBeNull()
  })

  it('allows extra credit, where the score is more than the points', () => {
    expect(calculateGrade(classOf({ items: [item(11, 10)] })).percent).toBe(110)
  })
})

describe('a class with weighted categories', () => {
  const cls = weighted([item(80, 100, 'Tests'), item(45, 50, 'Homework')])

  it('weights each category by its share of the grade', () => {
    const result = calculateGrade(cls)
    expect(result.method).toBe('weighted')
    expect(result.percent).toBe(84)
    expect(result.categories.map(c => [c.name, c.percent])).toEqual([['Tests', 80], ['Homework', 90]])
  })

  it('adds points within a category, not averages of percentages', () => {
    const result = calculateGrade(weighted([item(10, 10, 'Tests'), item(0, 90, 'Tests'), item(1, 1, 'Homework')]))
    expect(result.categories[0].percent).toBe(10)
    expect(result.percent).toBe(46)
  })

  it('leaves out a category with nothing graded, so it does not pull the grade down', () => {
    const withFinal = weighted(cls.items, { categories: [category('Tests', 60), category('Homework', 40), category('Final', 20)] })
    expect(calculateGrade(withFinal).percent).toBe(84)
    expect(calculateGrade(withFinal).categories.find(c => c.name === 'Final')?.percent).toBeNull()
  })
})

describe('which work counts', () => {
  it('counts work with a score even while a resubmission waits for a grade (the blue square)', () => {
    expect(calculateGrade(classOf({ items: [item(8, 10, null, 'submitted'), item(10, 10)] })).percent).toBe(90)
  })

  it('leaves out work with no grade, excused work, and written grades with no points', () => {
    const items = [item(10, 10), item(null, null, null, 'submitted'), item(null, null, null, 'ungraded'), item(null, 10, null, 'excused'), item(null, null, null, 'graded'), item(0, null, null, 'missing')]
    expect(calculateGrade(classOf({ items }))).toMatchObject({ percent: 100, counted: 1 })
  })
})

describe('matching the grade Schoology shows', () => {
  it('adds the points of missing work that the page does not list', () => {
    // The page lists 80/100, but Schoology says 64%: 25 more points are hidden, which must be missing zeros.
    const cls = classOf({ categories: [category('Tests', 100, 64)], items: [item(80, 100, 'Tests')] })
    const result = calculateGrade(cls)
    expect(result.percent).toBe(64)
    expect(result.categories[0]).toMatchObject({ earned: 80, possible: 125, adjusted: true })
  })

  it('keeps the grade when Schoology rounds a little differently than the page', () => {
    expect(calculateGrade(classOf({ categories: [category('Tests', 100, 93.6774)], items: [item(117, 125, 'Tests')] })).percent).toBe(93.68)
  })

  it('does not flag a category that already agrees with Schoology', () => {
    expect(calculateGrade(classOf({ categories: [category('Tests', 100, 80)], items: [item(80, 100, 'Tests')] })).categories[0]).toMatchObject({ percent: 80, adjusted: false, fixed: false })
  })

  it('uses the class grade for a class without categories', () => {
    expect(calculateGrade(classOf({ reportedPercent: 80, items: [item(80, 100)] })).percent).toBe(80)
    expect(calculateGrade(classOf({ reportedPercent: 64, items: [item(80, 100)] })).percent).toBe(64)
  })

  it('takes the percentage as Schoology gives it for a category graded with written grades', () => {
    const cls = classOf({ categories: [category('Tests', 50, 90), category('Skills', 50, 70)], items: [item(90, 100, 'Tests'), item(null, null, 'Skills')] })
    const result = calculateGrade(cls)
    expect(result.categories.find(c => c.name === 'Skills')).toMatchObject({ percent: 70, fixed: true })
    expect(result.percent).toBe(80)
  })
})

describe('a grade with changes', () => {
  it('is the same as the original when nothing changed', () => {
    const cls = weighted([item(80, 100, 'Tests'), item(45, 50, 'Homework')])
    expect(calculateEditedGrade(cls, cls)).toEqual(calculateGrade(cls))
  })

  it('moves when a score is changed', () => {
    const cls = classOf({ items: [item(9, 10), item(18, 20)] })
    const result = calculateEditedGrade(cls, withItems(cls, [item(9, 10), item(20, 20)]))
    expect(result.percent).toBe(96.67)
  })

  it('counts work that now has a score, and stops counting a score that was cleared', () => {
    const cls = classOf({ items: [item(9, 10), item(null, 20, null, 'ungraded')] })
    expect(calculateEditedGrade(cls, withItems(cls, [item(9, 10), item(10, 20)])).percent).toBe(63.33)
    expect(calculateEditedGrade(cls, withItems(cls, [item(null, 10, null, 'ungraded'), item(null, 20, null, 'ungraded')])).percent).toBeNull()
  })

  it('counts an added assignment in its category', () => {
    const cls = weighted([item(80, 100, 'Tests'), item(45, 50, 'Homework')])
    const result = calculateEditedGrade(cls, withItems(cls, [...cls.items, item(90, 100, 'Tests')]))
    expect(result.categories[0].percent).toBe(85)
    expect(result.percent).toBe(87)
  })

  it('shows what the final would do to the grade', () => {
    const cls = weighted([item(80, 100, 'Tests'), item(45, 50, 'Homework')], { categories: [category('Tests', 60), category('Homework', 40), category('Final', 20)] })
    expect(calculateEditedGrade(cls, withItems(cls, [...cls.items, item(100, 100, 'Final')])).percent).toBe(86.67)
  })

  it("keeps the work the page can't list, so only the change moves the grade", () => {
    // Schoology shows 64% but the page lists 80/100: the other 25 points are missing work that stays missing.
    const cls = classOf({ categories: [category('Tests', 100, 64)], items: [item(80, 100, 'Tests')] })
    const result = calculateEditedGrade(cls, withItems(cls, [...cls.items, item(25, 25, 'Tests')]))
    expect(result.percent).toBe(70)
    expect(result.categories[0]).toMatchObject({ adjusted: true, earned: 105, possible: 150 })
  })

  it('does not change a category Schoology works out from written grades', () => {
    const cls = classOf({ categories: [category('Tests', 50, 90), category('Skills', 50, 70)], items: [item(90, 100, 'Tests'), item(null, null, 'Skills')] })
    const result = calculateEditedGrade(cls, withItems(cls, [...cls.items, item(0, 10, 'Skills')]))
    expect(result.categories.find(c => c.name === 'Skills')).toMatchObject({ percent: 70, fixed: true })
    expect(result.percent).toBe(80)
  })

  it('does not change the classes it was given', () => {
    const cls = Object.freeze({ ...weighted([item(80, 100, 'Tests')]), items: Object.freeze([item(80, 100, 'Tests')]) }) as CalcClass
    const edited = Object.freeze({ ...cls, items: Object.freeze([item(10, 10, 'Tests')]) }) as CalcClass
    expect(() => calculateEditedGrade(cls, edited)).not.toThrow()
    expect(calculateGrade(cls).percent).toBe(80)
  })

  it('ignores work in a category the original does not have', () => {
    const cls = weighted([item(80, 100, 'Tests')])
    expect(calculateEditedGrade(cls, withItems(cls, [...cls.items, item(0, 100, 'Labs')])).percent).toBe(80)
  })
})
