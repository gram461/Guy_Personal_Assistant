import type { AssignmentSnapshot, CategorySnapshot, CourseSnapshot, GradingPeriodSnapshot, SchoologySnapshot } from './snapshot'
import type { ScrapedAssignment } from './parseAssignments'
import type { GradeCourse } from './parseGrades'

const PACIFIC_TZ = 'America/Los_Angeles'

// Schoology gives term names but no dates, so "26-27 T1" is treated as lasting the whole school year.
export function periodDates(name: string, now = new Date()): { startsOn: string; endsOn: string } {
  const named = name.match(/\b(\d{2})-(\d{2})\b/)
  if (named) return { startsOn: `20${named[1]}-07-01`, endsOn: `20${named[2]}-06-30` }

  const [year, month] = now.toLocaleDateString('en-CA', { timeZone: PACIFIC_TZ }).split('-').map(Number)
  const startYear = month >= 7 ? year : year - 1
  return { startsOn: `${startYear}-07-01`, endsOn: `${startYear + 1}-06-30` }
}

export function pacificToIso(date: string, hours: number, minutes: number): string {
  const asUtc = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`)
  const pacific = new Date(asUtc.toLocaleString('en-US', { timeZone: PACIFIC_TZ }))
  const utc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(asUtc.getTime() + (utc.getTime() - pacific.getTime())).toISOString()
}

function gradesDue(dueDate: string | null, dueTime: string | null): { dueAt: string | null; dueAllDay: boolean } {
  if (!dueDate) return { dueAt: null, dueAllDay: false }
  const time = dueTime?.match(/(\d{1,2}):(\d{2})\s*([ap])m/i)
  if (!time) return { dueAt: pacificToIso(dueDate, 12, 0), dueAllDay: true }
  const hours = (Number(time[1]) % 12) + (time[3].toLowerCase() === 'p' ? 12 : 0)
  return { dueAt: pacificToIso(dueDate, hours, Number(time[2])), dueAllDay: false }
}

// The homepage stores "no time set" as 23:59:59 UTC, which would otherwise read as 3:59 PM.
function homepageDueAllDay(dueAt: string) {
  return new Date(dueAt).getUTCHours() === 23 && new Date(dueAt).getUTCMinutes() === 59 && new Date(dueAt).getUTCSeconds() === 59
}

export function toSnapshot(grades: GradeCourse[], homepage: ScrapedAssignment[], now = new Date()): SchoologySnapshot {
  const gradingPeriods = new Map<string, GradingPeriodSnapshot>()
  const courses: CourseSnapshot[] = []
  const categories: CategorySnapshot[] = []
  const assignments = new Map<string, AssignmentSnapshot>()
  const mainPeriodByCourse = new Map<string, { sectionId: string; periodId: string }>()

  for (const course of grades) {
    // A class is stored once per term it has work in, or under its first term if it has none yet.
    const usedPeriods = course.periods.filter(p => course.items.some(i => i.periodId === p.periodId))
    const kept = usedPeriods.length > 0 ? usedPeriods : course.periods.slice(0, 1)

    for (const period of kept) {
      gradingPeriods.set(period.periodId, { periodId: period.periodId, name: period.name, ...periodDates(period.name, now) })
      courses.push({
        periodId: period.periodId,
        sectionId: course.sectionId,
        name: course.courseName,
        teacherName: course.teacher,
        gradePercent: course.gradePercent,
        gradeLetter: course.gradeLetter,
      })
    }

    for (const category of course.categories) {
      if (!kept.some(p => p.periodId === category.periodId)) continue
      categories.push({
        periodId: category.periodId,
        sectionId: course.sectionId,
        categoryId: category.categoryId,
        name: category.name,
        weight: category.weight,
        gradePercent: category.gradePercent,
      })
    }

    for (const item of course.items) {
      assignments.set(item.assignmentId, {
        periodId: item.periodId,
        sectionId: course.sectionId,
        assignmentId: item.assignmentId,
        categoryId: item.categoryId,
        title: item.title,
        description: '',
        ...gradesDue(item.dueDate, item.dueTime),
        score: item.score,
        maxPoints: item.maxPoints,
        gradeText: item.gradeText,
        status: item.status,
        isLate: false,
        hasSubmission: item.hasSubmission,
      })
    }

    if (kept[0]) mainPeriodByCourse.set(`${course.courseName}|${course.teacher}`, { sectionId: course.sectionId, periodId: kept[0].periodId })
  }

  // The grades page wins when an assignment is on both; these are the ones only the homepage lists.
  for (const item of homepage) {
    if (assignments.has(item.assignmentId)) continue
    const home = mainPeriodByCourse.get(`${item.courseName}|${item.teacher}`)
    if (!home) continue
    assignments.set(item.assignmentId, {
      ...home,
      assignmentId: item.assignmentId,
      categoryId: null,
      title: item.title,
      description: '',
      dueAt: item.dueAt,
      dueAllDay: homepageDueAllDay(item.dueAt),
      score: null,
      maxPoints: null,
      gradeText: null,
      status: 'ungraded',
      isLate: false,
      hasSubmission: false,
    })
  }

  return { gradingPeriods: [...gradingPeriods.values()], courses, categories, assignments: [...assignments.values()] }
}
