import { supabaseServer } from './supabaseServer'
import { encryptSecret, decryptSecret } from './tokenCrypto'
import type { Assignment } from './assignments'

const PACIFIC_TZ = 'America/Los_Angeles'
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DESCRIPTION_LENGTH = 2000

const sessionContext = (userId: string) => `schoology_session:${userId}`

function pacificDateKey(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: PACIFIC_TZ })
}

export type SyncStatus = 'ok' | 'session_expired' | 'failed'
export type AssignmentStatus = 'ungraded' | 'graded' | 'missing' | 'excused'

export type GradingPeriodSnapshot = { periodId: string; name: string; startsOn: string; endsOn: string }
export type CourseSnapshot = {
  periodId: string
  sectionId: string
  name: string
  gradePercent: number | null
  gradeLetter: string | null
}
export type CategorySnapshot = {
  periodId: string
  sectionId: string
  categoryId: string
  name: string
  weight: number | null
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
  status: AssignmentStatus
  isLate: boolean
}
export type SchoologySnapshot = {
  gradingPeriods: GradingPeriodSnapshot[]
  courses: CourseSnapshot[]
  categories: CategorySnapshot[]
  assignments: AssignmentSnapshot[]
}

export async function saveSchoologySession(
  userId: string,
  session: string,
  details: { schoologyUserId?: string; expiresAt?: Date } = {},
) {
  const { error } = await supabaseServer.from('schoology_connections').upsert({
    user_id: userId,
    session_encrypted: encryptSecret(session, sessionContext(userId)),
    schoology_user_id: details.schoologyUserId ?? null,
    expires_at: details.expiresAt?.toISOString() ?? null,
    connected_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Failed to save Schoology session: ${error.message}`)
}

export async function loadSchoologySession(
  userId: string,
): Promise<{ session: string; schoologyUserId: string | null } | null> {
  const { data } = await supabaseServer
    .from('schoology_connections')
    .select('session_encrypted, schoology_user_id, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null

  try {
    return { session: decryptSecret(data.session_encrypted, sessionContext(userId)), schoologyUserId: data.schoology_user_id }
  } catch {
    // Unreadable (encryption key changed or row tampered with): treat as disconnected so the user reconnects.
    return null
  }
}

export async function recordSyncResult(userId: string, status: SyncStatus) {
  const now = new Date().toISOString()
  const { error } = await supabaseServer
    .from('schoology_connections')
    .update({ last_attempt_at: now, last_sync_status: status, ...(status === 'ok' ? { last_success_at: now } : {}) })
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to record sync result: ${error.message}`)
}

export async function saveSchoologySnapshot(userId: string, snapshot: SchoologySnapshot) {
  const { error } = await supabaseServer.rpc('save_schoology_snapshot', {
    p_user_id: userId,
    p_snapshot: {
      grading_periods: snapshot.gradingPeriods.map(p => ({
        period_id: p.periodId,
        name: p.name,
        starts_on: p.startsOn,
        ends_on: p.endsOn,
      })),
      courses: snapshot.courses.map(c => ({
        period_id: c.periodId,
        section_id: c.sectionId,
        name: c.name,
        grade_percent: c.gradePercent,
        grade_letter: c.gradeLetter,
      })),
      categories: snapshot.categories.map(c => ({
        period_id: c.periodId,
        section_id: c.sectionId,
        category_id: c.categoryId,
        name: c.name,
        weight: c.weight,
      })),
      assignments: snapshot.assignments.map(a => ({
        period_id: a.periodId,
        section_id: a.sectionId,
        assignment_id: a.assignmentId,
        category_id: a.categoryId,
        title: a.title,
        description: a.description.slice(0, MAX_DESCRIPTION_LENGTH),
        due_at: a.dueAt,
        due_all_day: a.dueAllDay,
        score: a.score,
        max_points: a.maxPoints,
        status: a.status,
        is_late: a.isLate,
      })),
    },
  })
  if (error) throw new Error(`Failed to save Schoology data: ${error.message}`)
}

export async function loadUpcomingAssignments(userId: string): Promise<Assignment[]> {
  const from = new Date(Date.now() - 14 * DAY_MS).toISOString()
  const to = new Date(Date.now() + 30 * DAY_MS).toISOString()

  const { data, error } = await supabaseServer
    .from('assignments')
    .select('assignment_id, title, description, due_at, due_all_day')
    .eq('user_id', userId)
    .gte('due_at', from)
    .lte('due_at', to)
    .order('due_at')
  if (error) throw new Error(`Failed to load assignments: ${error.message}`)

  return (data ?? []).map(a => ({
    uid: a.assignment_id,
    title: a.title,
    description: a.description,
    date: a.due_all_day ? pacificDateKey(new Date(a.due_at)) : new Date(a.due_at).toISOString(),
  }))
}

export async function deleteEndedGradingPeriods() {
  const { error } = await supabaseServer.from('grading_periods').delete().lt('ends_on', pacificDateKey(new Date()))
  if (error) throw new Error(`Failed to delete old grading periods: ${error.message}`)
}
