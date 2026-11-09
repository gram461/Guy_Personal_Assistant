export type AssignmentStatus = 'ungraded' | 'submitted' | 'graded' | 'missing' | 'excused'

export type GradingPeriodSnapshot = { periodId: string; name: string; startsOn: string; endsOn: string }

export type CourseSnapshot = {
  periodId: string
  sectionId: string
  name: string
  teacherName: string | null
  gradePercent: number | null
  gradeLetter: string | null
}

export type CategorySnapshot = {
  periodId: string
  sectionId: string
  categoryId: string
  name: string
  weight: number | null
  // The category grade Schoology shows. It can include work the page doesn't list, such as missing assignments.
  gradePercent: number | null
}

export type AssignmentSnapshot = {
  periodId: string
  sectionId: string
  assignmentId: string
  categoryId: string | null
  title: string
  description: string
  // For all-day items (dueAllDay), any time on the due date in Pacific time.
  dueAt: string | null
  dueAllDay: boolean
  score: number | null
  maxPoints: number | null
  gradeText: string | null
  status: AssignmentStatus
  isLate: boolean
  hasSubmission: boolean
}

export type SchoologySnapshot = {
  gradingPeriods: GradingPeriodSnapshot[]
  courses: CourseSnapshot[]
  categories: CategorySnapshot[]
  assignments: AssignmentSnapshot[]
}
