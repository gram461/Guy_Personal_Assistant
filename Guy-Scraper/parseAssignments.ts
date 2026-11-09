import * as cheerio from 'cheerio'
import { ScraperLayoutError } from './errors'

export type ScrapedAssignment = {
  assignmentId: string
  title: string
  dueAt: string
  courseLabel: string
  courseName: string
  teacher: string | null
}

// Section labels look like "Chemistry H - 3620 : SmithJ p3 T1", where SmithJ is the teacher.
const SECTION_WITH_TEACHER = /^(.+?)\s*:\s*([^\s:]+)\s+p\S*(?:\s+\S+)*$/

export function parseCourseLabel(label: string): { courseName: string; teacher: string | null } {
  const withTeacher = label.match(SECTION_WITH_TEACHER)
  if (withTeacher) return { courseName: withTeacher[1].trim(), teacher: withTeacher[2] }
  return { courseName: label.split(':')[0].trim(), teacher: null }
}

export function parseAssignments(html: string): ScrapedAssignment[] {
  if (!html.trim()) return []

  const $ = cheerio.load(html)
  if ($('.upcoming-list').length === 0) {
    throw new ScraperLayoutError('Assignments response has no .upcoming-list')
  }

  // Hidden rows count: the page hides them only to shorten its list, and they are still real assignments.
  const found = new Map<string, ScrapedAssignment>()
  $('.upcoming-event').each((_, row) => {
    const link = $(row).find('.event-title a').first()
    const href = link.attr('href') ?? ''
    if (href.includes('/event/')) return

    const assignmentId = href.match(/(\d+)(?:[/?#]|$)/)?.[1]
    const title = link.text().trim()
    const dueSeconds = Number($(row).attr('data-start'))
    const courseLabel = $(row).find('.realm-title-course').first().text().trim()
    if (!assignmentId || !title || !dueSeconds || !courseLabel) {
      throw new ScraperLayoutError('Assignment row is missing its id, title, due date or course')
    }

    found.set(assignmentId, {
      assignmentId,
      title,
      dueAt: new Date(dueSeconds * 1000).toISOString(),
      courseLabel,
      ...parseCourseLabel(courseLabel),
    })
  })
  return [...found.values()]
}
