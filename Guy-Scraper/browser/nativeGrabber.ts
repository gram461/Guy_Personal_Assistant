import { ScraperLayoutError, SessionExpiredError } from '../errors'
import { scrapeSnapshot } from '../scrapeSnapshot'
import { buildGradesTsv } from '../tsv'
import { GRADES_MESSAGE, ERROR_MESSAGE, type ErrorReason } from './messages'
import { createPageClient } from './pageClient'

// The phone app's version of the helper. The app opens Schoology in its own window, and once the person is signed in it injects
// this script there. It reads the grades with that window's login and sends them back to the app through the window's built-in
// bridge. There is nothing to click: no panel, no new tab, and nothing is uploaded.

declare const __SCHOOLOGY_ORIGIN__: string
type AppBridge = { postMessage: (message: { detail: unknown }) => void }

const bridge = (window as unknown as { mobileApp?: AppBridge }).mobileApp
const tell = (detail: unknown) => bridge?.postMessage({ detail })
const fail = (reason: ErrorReason) => tell({ type: ERROR_MESSAGE, version: 1, reason })

async function run() {
  if (location.origin !== __SCHOOLOGY_ORIGIN__) return fail('wrong-site')
  // The sign-in can land on the home page before it has finished loading.
  if (document.readyState === 'loading') await new Promise<void>(resolve => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }))

  try {
    const { text, classes } = buildGradesTsv(await scrapeSnapshot(createPageClient()), new Date())
    if (classes === 0) return fail('no-classes')
    tell({ type: GRADES_MESSAGE, version: 1, tsv: text })
  } catch (err) {
    fail(err instanceof SessionExpiredError ? 'signed-out' : err instanceof ScraperLayoutError ? 'layout' : 'network')
  }
}

void run()
