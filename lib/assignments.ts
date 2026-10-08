import { getCompletedUids } from './completedAssignments'

export type Assignment = { title: string; date: string; description: string; uid: string }

export async function fetchAssignments(userId: string): Promise<Assignment[]> {
  // No assignment source yet: the Schoology scraper will feed this list.
  const assignments: Assignment[] = []
  const completed = await getCompletedUids(userId)
  return assignments.filter(a => !completed.has(a.uid))
}
