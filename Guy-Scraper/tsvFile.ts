import path from 'node:path'
import { atomicWriteFile } from './atomicWrite'
import type { SchoologySnapshot } from './snapshot'
import { buildGradesTsv } from './tsv'

// The parts of the grades file that need the computer's file system. Kept apart from tsv.ts so the browser can use that one.

// Shipped with the program as a header-only file; the scraper fills it in on the user's own computer.
export const DEFAULT_GRADES_PATH = path.join(__dirname, 'data', 'grades.tsv')

export async function writeGradesFile(
  filePath: string,
  snapshot: SchoologySnapshot,
  scrapedAt = new Date(),
): Promise<{ classes: number; assignments: number }> {
  const { text: content, classes, assignments } = buildGradesTsv(snapshot, scrapedAt)
  await atomicWriteFile(filePath, content)
  return { classes, assignments }
}
