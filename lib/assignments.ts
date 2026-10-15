import { getCompletedUids } from './completedAssignments'
import { loadUpcomingAssignments } from './schoologyStore'

export type Assignment = { title: string; date: string; description: string; uid: string }

export async function fetchAssignments(userId: string): Promise<Assignment[]> {
  const [assignments, completed] = await Promise.all([loadUpcomingAssignments(userId), getCompletedUids(userId)])
  return assignments.filter(a => !completed.has(a.uid))
}
