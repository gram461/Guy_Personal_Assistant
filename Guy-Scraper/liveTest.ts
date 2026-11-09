import path from 'node:path'
import { chromium } from 'playwright'
import { createSchoologyClient } from './client'
import { ScraperLayoutError, SessionExpiredError } from './errors'
import { parseAssignments, type ScrapedAssignment } from './parseAssignments'
import { parseGrades, type GradeCourse, type GradeStatus } from './parseGrades'
import { toSnapshot } from './toSnapshot'
import { DEFAULT_GRADES_PATH, writeGradesFile } from './tsv'

const ORIGIN = 'https://fuhsd.schoology.com'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const STATUSES: GradeStatus[] = ['graded', 'submitted', 'missing', 'excused', 'ungraded']

async function step<T>(label: string, run: () => Promise<T>, describe: (result: T) => string): Promise<T> {
  process.stdout.write(`${label}... `)
  try {
    const result = await run()
    console.log(`OK (${describe(result)})`)
    return result
  } catch (err) {
    console.log('FAILED')
    throw err
  }
}

function explain(err: unknown): string {
  if (err instanceof SessionExpiredError) {
    return 'Schoology rejected the session or redirected to login, so plain requests with the session cookies were not accepted.'
  }
  if (err instanceof ScraperLayoutError) {
    return `Schoology answered, but not in the expected format: ${err.message}. The raw page differs from the saved copy.`
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return 'Unknown error'
}

function report(courses: GradeCourse[], homepage: ScrapedAssignment[]) {
  const onGradesPage = new Set(courses.flatMap(c => c.items.map(i => i.assignmentId)))
  const homepageOnly = homepage.filter(a => !onGradesPage.has(a.assignmentId))

  console.log(`\n${'Class'.padEnd(30)}${'Average'.padEnd(12)}${'Total'.padStart(6)}${STATUSES.map(s => s.slice(0, 6).padStart(8)).join('')}`)
  for (const course of courses) {
    const average = [course.gradeLetter, course.gradePercent === null ? null : `${course.gradePercent.toFixed(1)}%`].filter(Boolean).join(' ') || '-'
    const counts = STATUSES.map(s => String(course.items.filter(i => i.status === s).length).padStart(8)).join('')
    console.log(`${course.courseName.slice(0, 29).padEnd(30)}${average.padEnd(12)}${String(course.items.length).padStart(6)}${counts}`)
  }

  console.log(`\nClasses: ${courses.length}`)
  console.log(`On the grades page: ${onGradesPage.size}`)
  console.log(`In the homepage lists: ${homepage.length} (${homepageOnly.length} not on the grades page)`)
  console.log(`Total different assignments: ${onGradesPage.size + homepageOnly.length}`)
}

// Signs in through a throwaway browser window. The session lives only in memory and is never printed or saved.
async function signIn(): Promise<string> {
  const browser = await chromium.launch({ headless: false })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${ORIGIN}/`)
    console.log('Sign in to your own Schoology account in the window that opened. Waiting up to 5 minutes...')
    await page.waitForURL(url => url.origin === ORIGIN && url.pathname.startsWith('/home'), { timeout: SIGN_IN_TIMEOUT_MS })

    const cookies = await context.cookies(ORIGIN)
    return cookies.map(c => `${c.name}=${c.value}`).join('; ')
  } finally {
    await browser.close()
  }
}

async function main() {
  const tsvFlag = process.argv.find(a => a === '--tsv' || a.startsWith('--tsv='))
  const tsvPath = tsvFlag ? path.resolve(tsvFlag.split('=')[1] || DEFAULT_GRADES_PATH) : null
  console.log(`Live test: ${tsvPath ? `writes your grades to ${tsvPath}, nothing else` : 'read-only, saves nothing'}. Use only your own account.\n`)

  try {
    const client = createSchoologyClient(await signIn())
    console.log('Signed in. Browser closed.\n')

    const overdue = await step('Overdue list', () => client.getAjaxHtml('/home/overdue_submissions_ajax').then(parseAssignments), r => `${r.length} assignments`)
    const upcoming = await step('Upcoming list', () => client.getAjaxHtml('/home/upcoming_submissions_ajax').then(parseAssignments), r => `${r.length} assignments`)
    const courses = await step('Grades page', () => client.getPage('/grades/grades').then(parseGrades), r => `${r.length} classes`)

    const homepage = [...new Map([...overdue, ...upcoming].map(a => [a.assignmentId, a])).values()]
    report(courses, homepage)
    console.log('\nConnection worked. Compare these counts with what Schoology shows.')
    if (tsvPath) {
      const written = await writeGradesFile(tsvPath, toSnapshot(courses, homepage))
      console.log(`\nWrote ${written.classes} classes and ${written.assignments} assignments to ${tsvPath}`)
      console.log('That file now holds real grades. Do not commit it or share it.')
    }
  } catch (err) {
    console.error(`\n${explain(err)}`)
    process.exitCode = 1
  }
}

main()
