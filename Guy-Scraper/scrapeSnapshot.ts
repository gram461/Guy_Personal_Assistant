import { parseAssignments } from './parseAssignments'
import { parseGrades } from './parseGrades'
import type { SchoologySnapshot } from './snapshot'
import { toSnapshot } from './toSnapshot'

// Something that can fetch Schoology pages for the signed-in person. The desktop app uses a client that sends the saved
// login cookies; the in-browser helper uses the Schoology tab's own login. Everything after the fetching is shared.
export type SchoologyPages = {
  getAjaxHtml: (path: string) => Promise<string>
  getPage: (path: string) => Promise<string>
}

// Reads everything the app needs. If any part fails, nothing is returned, so callers never save half of what Schoology showed.
export async function scrapeSnapshot(pages: SchoologyPages): Promise<SchoologySnapshot> {
  const overdue = parseAssignments(await pages.getAjaxHtml('/home/overdue_submissions_ajax'))
  const upcoming = parseAssignments(await pages.getAjaxHtml('/home/upcoming_submissions_ajax'))
  const courses = parseGrades(await pages.getPage('/grades/grades'))
  return toSnapshot(courses, [...overdue, ...upcoming])
}
