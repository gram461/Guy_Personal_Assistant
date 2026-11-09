// What the user changed on the grade page, kept on this computer between visits.
// Nothing here is a grade from Schoology: it is the scores they typed, the points they filled in, and the assignments they added.

export type AddedAssignment = { id: number; title: string; category: string; points: number }

export type SavedEdits = {
  // A score the user typed, by Schoology assignment id (or "add-<id>" for an added assignment). Text, so half-typed numbers survive.
  scores: Record<string, string>
  // Points the user filled in for work whose points Schoology doesn't show, by assignment id.
  points: Record<string, string>
  // Assignments the user added, by class key (GradebookClass.key).
  added: Record<string, AddedAssignment[]>
}

export const MAX_ENTRIES = 2000
export const MAX_ID_LENGTH = 40
export const MAX_TEXT_LENGTH = 20
export const MAX_ADDED_PER_CLASS = 50
export const MAX_CLASSES = 200
export const MAX_CLASS_KEY_LENGTH = 300
export const MAX_TITLE_LENGTH = 60
const MAX_CATEGORY_LENGTH = 100
const LARGEST_POINTS = 1_000_000
const FILE_VERSION = 1

export const emptyEdits = (): SavedEdits => ({ scores: {}, points: {}, added: {} })

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function sanitizeTextMap(input: unknown): Record<string, string> {
  if (!isPlainObject(input)) return {}
  const kept = Object.entries(input)
    .slice(0, MAX_ENTRIES)
    .filter(([key, value]) => key.length > 0 && key.length <= MAX_ID_LENGTH && typeof value === 'string' && value.length <= MAX_TEXT_LENGTH)
  // Object.fromEntries defines own properties, so a key like "__proto__" is just a key.
  return Object.fromEntries(kept) as Record<string, string>
}

function sanitizeAdded(input: unknown): Record<string, AddedAssignment[]> {
  if (!isPlainObject(input)) return {}

  const kept: [string, AddedAssignment[]][] = []
  for (const [classKey, list] of Object.entries(input).slice(0, MAX_CLASSES)) {
    if (classKey.length === 0 || classKey.length > MAX_CLASS_KEY_LENGTH || !Array.isArray(list)) continue

    const assignments = list.slice(0, MAX_ADDED_PER_CLASS).flatMap((raw): AddedAssignment[] => {
      if (!isPlainObject(raw)) return []
      const { id, title, category, points } = raw
      const valid =
        typeof id === 'number' && Number.isInteger(id) && id >= 1 &&
        typeof title === 'string' &&
        typeof category === 'string' && category.length > 0 && category.length <= MAX_CATEGORY_LENGTH &&
        typeof points === 'number' && Number.isFinite(points) && points > 0 && points <= LARGEST_POINTS
      return valid ? [{ id, title: title.slice(0, MAX_TITLE_LENGTH), category, points }] : []
    })
    if (assignments.length > 0) kept.push([classKey, assignments])
  }
  return Object.fromEntries(kept)
}

// Keeps what makes sense and drops the rest, so a damaged file or an odd request can't put junk in the grade page.
export function sanitizeEdits(input: unknown): SavedEdits {
  if (!isPlainObject(input)) return emptyEdits()
  return { scores: sanitizeTextMap(input.scores), points: sanitizeTextMap(input.points), added: sanitizeAdded(input.added) }
}

export function serializeEdits(edits: SavedEdits): string {
  return JSON.stringify({ version: FILE_VERSION, ...edits })
}

// A file that can't be read gives no edits instead of an error: the grades themselves are safe, and the next save replaces it.
export function parseEdits(text: string): SavedEdits {
  try {
    const data: unknown = JSON.parse(text)
    return isPlainObject(data) && data.version === FILE_VERSION ? sanitizeEdits(data) : emptyEdits()
  } catch {
    return emptyEdits()
  }
}
