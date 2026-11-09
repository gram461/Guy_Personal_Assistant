import { createSchoologyClient } from './client'
import { parseAssignments } from './parseAssignments'
import { parseGrades } from './parseGrades'
import type { SchoologySnapshot } from './snapshot'
import { toSnapshot } from './toSnapshot'

// Reads everything the app needs from the signed-in session. If any part fails, nothing is returned,
// so callers never save half of what Schoology showed.
export async function fetchSnapshot(session: string, options: { delayMs?: number } = {}): Promise<SchoologySnapshot> {
  const client = createSchoologyClient(session, options)
  const overdue = parseAssignments(await client.getAjaxHtml('/home/overdue_submissions_ajax'))
  const upcoming = parseAssignments(await client.getAjaxHtml('/home/upcoming_submissions_ajax'))
  const courses = parseGrades(await client.getPage('/grades/grades'))
  return toSnapshot(courses, [...overdue, ...upcoming])
}
