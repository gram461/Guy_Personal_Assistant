import * as cheerio from 'cheerio'
import { ScraperLayoutError } from './errors'
import { parseCourseLabel } from './parseAssignments'

// graded: has a grade. submitted: turned in, waiting on a grade (the blue square).
// ungraded: no grade and no online submission, which may still mean turned in on paper.
export type GradeStatus = 'graded' | 'submitted' | 'missing' | 'excused' | 'ungraded'

export type GradeItem = {
  assignmentId: string
  periodId: string
  categoryId: string | null
  title: string
  dueDate: string | null
  dueTime: string | null
  score: number | null
  maxPoints: number | null
  gradeText: string | null
  status: GradeStatus
  hasSubmission: boolean
}

export type GradePeriod = { periodId: string; name: string; gradePercent: number | null; gradeLetter: string | null }
export type GradeCategory = { categoryId: string; periodId: string; name: string; weight: number | null; gradePercent: number | null }

export type GradeCourse = {
  sectionId: string
  label: string
  courseName: string
  teacher: string | null
  gradePercent: number | null
  gradeLetter: string | null
  periods: GradePeriod[]
  categories: GradeCategory[]
  items: GradeItem[]
}

function number(text: string | undefined): number | null {
  const match = text?.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

function parseDue(text: string): { dueDate: string | null; dueTime: string | null } {
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+(\d{1,2}:\d{2}\s*[ap]m))?/i)
  if (!match) return { dueDate: null, dueTime: null }
  const [, month, day, year, time] = match
  return { dueDate: `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, dueTime: time ?? null }
}

export function parseGrades(html: string): GradeCourse[] {
  const $ = cheerio.load(html)
  const sections = $('.gradebook-course')
  if (sections.length === 0) throw new ScraperLayoutError('Grades page has no .gradebook-course')

  const visibleText = (element: ReturnType<typeof $>) => {
    const copy = element.clone()
    copy.find('.visually-hidden').remove()
    return copy.text().trim()
  }

  return sections.toArray().map(section => {
    const course = $(section)
    const sectionId = course.attr('id')?.match(/(\d+)$/)?.[1]
    const label = visibleText(course.find('.gradebook-course-title a').first())
    if (!sectionId || !label) throw new ScraperLayoutError('Class is missing its id or title')

    // Some classes show a bare letter ("A") instead of the usual "A (93%)" markup.
    const overallLetter = (cell: ReturnType<typeof $>) => {
      const alpha = cell.find('.alpha-grade').first().text().trim()
      if (alpha) return alpha
      const awarded = cell.find('.awarded-grade').first().clone()
      awarded.find('.numeric-grade, .rounded-grade').remove()
      return awarded.text().trim() || null
    }

    const courseGrade = course.find('tr.course-row td.grade-column').first()

    const periods: GradePeriod[] = course.find('tr.period-row').toArray().map(row => {
      const grade = $(row).find('td.grade-column').first()
      return {
        periodId: $(row).attr('data-id') ?? '',
        name: visibleText($(row).find('.title').first()),
        gradePercent: number(grade.find('.rounded-grade').attr('title')),
        gradeLetter: overallLetter(grade),
      }
    })

    const categories: GradeCategory[] = course.find('tr.category-row').toArray().map(row => ({
      categoryId: $(row).attr('data-id') ?? '',
      periodId: $(row).attr('data-parent-id') ?? '',
      name: visibleText($(row).find('.title').first()),
      weight: number($(row).find('.percentage-contrib').first().text()),
      gradePercent: number($(row).find('td.grade-column .rounded-grade').first().attr('title')),
    }))

    const items: GradeItem[] = course.find('tr.item-row').toArray().map(row => {
      const assignmentId = $(row).attr('data-id')?.match(/(\d+)$/)?.[1]
      const title = visibleText($(row).find('.title').first())
      if (!assignmentId || !title) throw new ScraperLayoutError('Grades row is missing its id or title')

      const parentId = $(row).attr('data-parent-id') ?? ''
      const category = categories.find(c => c.categoryId === parentId)
      const periodId = category?.periodId ?? parentId
      if (!periods.some(p => p.periodId === periodId)) {
        throw new ScraperLayoutError('Grades row does not belong to a grading period')
      }

      const grade = $(row).find('td.grade-column').first()
      const awarded = grade.find('.awarded-grade').first()
      const letterOrText = awarded.clone()
      letterOrText.find('.rounded-grade, .numeric-grade-value').remove()

      const exceptionIcon = grade.find('.exception-icon').first()
      let status: GradeStatus
      if (exceptionIcon.length > 0) {
        if (exceptionIcon.hasClass('missing')) status = 'missing'
        else if (exceptionIcon.hasClass('excused')) status = 'excused'
        else throw new ScraperLayoutError('Grades row has an unrecognized exception')
      } else if (grade.find('.grade-pending-icon').length > 0) {
        status = 'submitted'
      } else if (awarded.length > 0) {
        status = 'graded'
      } else {
        status = 'ungraded'
      }

      return {
        assignmentId,
        periodId,
        categoryId: category?.categoryId ?? null,
        title,
        ...parseDue($(row).find('.due-date').first().text()),
        score: number(awarded.find('.rounded-grade').attr('title')) ?? number(grade.find('.no-grade').first().text()),
        maxPoints: number(grade.find('.max-grade').first().text()),
        gradeText: letterOrText.text().trim() || null,
        status,
        hasSubmission: grade.find('.has-dropbox-icon').length > 0,
      }
    })

    return {
      sectionId,
      label,
      ...parseCourseLabel(label),
      gradePercent: number(courseGrade.find('.rounded-grade').attr('title')),
      gradeLetter: overallLetter(courseGrade),
      periods,
      categories,
      items,
    }
  })
}
