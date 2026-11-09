// Pure math with no file or network access, so the desktop window can run it on every keystroke.

export type CalcItem = {
  title: string
  category: string | null
  score: number | null
  maxPoints: number | null
  status: string
}

// reportedPercent is the category grade Schoology shows today (null if it shows none).
export type CalcCategory = { name: string; weight: number | null; reportedPercent: number | null }

// reportedPercent on the class is Schoology's grade for the whole class. It is only used for classes
// without weighted categories, and only when the class has a single term.
export type CalcClass = {
  name: string
  term: string
  reportedPercent: number | null
  categories: CalcCategory[]
  items: CalcItem[]
}

export type CategoryResult = {
  name: string
  weight: number | null
  earned: number
  possible: number
  percent: number | null
  counted: number
  // True when Schoology's own percentage added work this page can't list, such as missing assignments.
  adjusted: boolean
  // True when Schoology works this category out from written grades, so there are no points to change.
  fixed: boolean
}

export type GradeResult = {
  method: 'weighted' | 'points'
  percent: number | null
  categories: CategoryResult[]
  counted: number
}

const ALL_ASSIGNMENTS = 'All assignments'
const EPSILON = 1e-9

type Counted = { category: string | null; earned: number; possible: number }

const round2 = (value: number) => Math.round(value * 100) / 100
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

// Work with a score and points counts, whether or not a resubmission is waiting (the blue square), as Schoology does.
// Left out: excused work, work with no grade yet, and written grades that have no points.
function countedPoints(items: CalcItem[]): Counted[] {
  return items.flatMap(item => {
    const counts = item.status === 'graded' || item.status === 'submitted'
    if (counts && item.score !== null && item.maxPoints !== null && item.maxPoints >= 0) {
      return [{ category: item.category, earned: item.score, possible: item.maxPoints }]
    }
    return []
  })
}

type Group = { name: string; weight: number | null; reported: number | null; points: Counted[] }

function groupsOf(cls: CalcClass): { weighted: boolean; groups: Group[] } {
  const points = countedPoints(cls.items)
  const weighted = cls.categories.some(c => c.weight !== null && c.weight > 0)
  if (!weighted) {
    return { weighted, groups: [{ name: ALL_ASSIGNMENTS, weight: null, reported: cls.reportedPercent, points }] }
  }
  return {
    weighted,
    groups: cls.categories.map(c => ({ name: c.name, weight: c.weight, reported: c.reportedPercent, points: points.filter(p => p.category === c.name) })),
  }
}

type Figures = { earned: number; possible: number; adjusted: boolean; fixed: boolean }

// The page lists only some of the work Schoology counts: missing assignments count as zero, but their points aren't shown.
// Comparing what the page lists with the percentage Schoology reports reveals the hidden part, so the starting grade
// matches Schoology's.
function figuresFor(group: Group): Figures {
  const earned = sum(group.points.map(p => p.earned))
  const possible = sum(group.points.map(p => p.possible))
  const reported = group.reported

  if (reported === null) return { earned, possible, adjusted: false, fixed: false }
  if (group.points.length === 0) return { earned: 0, possible: 0, adjusted: false, fixed: true }
  if (possible <= 0 || reported <= 0) return { earned, possible, adjusted: false, fixed: false }

  const hiddenPossible = earned / (reported / 100) - possible
  if (hiddenPossible >= 0) {
    return { earned, possible: possible + hiddenPossible, adjusted: hiddenPossible > EPSILON, fixed: false }
  }
  const missingEarned = (reported / 100) * possible - earned
  return { earned: earned + missingEarned, possible, adjusted: Math.abs(missingEarned) > EPSILON, fixed: false }
}

// The grade for `edited`, a copy of `original` with some scores changed, points filled in, or assignments added.
// The hidden work is worked out from `original` and stays the same, so only the changes you made move the grade.
function grade(original: CalcClass, edited: CalcClass): GradeResult {
  const base = groupsOf(original)
  const now = groupsOf(edited)

  const raw = base.groups.map(group => {
    const figures = figuresFor(group)
    const current = now.groups.find(g => g.name === group.name)?.points ?? []
    const earned = figures.earned - sum(group.points.map(p => p.earned)) + sum(current.map(p => p.earned))
    const possible = figures.possible - sum(group.points.map(p => p.possible)) + sum(current.map(p => p.possible))
    const percent = figures.fixed ? group.reported : possible > 0 ? (earned / possible) * 100 : null
    return { group, figures, earned, possible, percent, counted: current.length }
  })

  const results: CategoryResult[] = raw.map(r => ({
    name: r.group.name,
    weight: r.group.weight,
    earned: round2(r.earned),
    possible: round2(r.possible),
    percent: r.percent === null ? null : round2(r.percent),
    counted: r.counted,
    adjusted: r.figures.adjusted,
    fixed: r.figures.fixed,
  }))
  const counted = sum(raw.map(r => r.counted))

  if (!base.weighted) return { method: 'points', percent: results[0].percent, categories: results, counted }

  // A category with nothing graded yet doesn't pull the grade down; the others share its weight.
  const included = raw.filter(r => r.percent !== null && r.group.weight !== null && r.group.weight > 0)
  const totalWeight = sum(included.map(r => r.group.weight as number))
  const percent = totalWeight > 0 ? sum(included.map(r => (r.percent as number) * (r.group.weight as number))) / totalWeight : null

  return { method: 'weighted', percent: percent === null ? null : round2(percent), categories: results, counted }
}

export function calculateGrade(cls: CalcClass): GradeResult {
  return grade(cls, cls)
}

export function calculateEditedGrade(original: CalcClass, edited: CalcClass): GradeResult {
  return grade(original, edited)
}
