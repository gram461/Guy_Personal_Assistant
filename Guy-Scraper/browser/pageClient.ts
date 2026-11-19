import { ScraperLayoutError, SessionExpiredError } from '../errors'
import type { SchoologyPages } from '../scrapeSnapshot'

const TIMEOUT_MS = 15_000
const DELAY_BETWEEN_REQUESTS_MS = 1_000

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Fetches Schoology pages from inside a Schoology tab. The tab's own login travels with each request (same site, so no cookies
// are copied or read), and the requests are the same ones the desktop app makes, a second apart.
export function createPageClient(options: { fetchImpl?: typeof fetch; delayMs?: number } = {}): SchoologyPages {
  const fetchImpl = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const delayMs = options.delayMs ?? DELAY_BETWEEN_REQUESTS_MS
  let hasRequested = false

  async function request(path: string, headers: Record<string, string>): Promise<Response> {
    if (!path.startsWith('/')) throw new Error('Schoology paths must be relative to the school site')
    if (hasRequested) await wait(delayMs)
    hasRequested = true

    // Redirects are not followed: they point at the login page, which means the person is signed out.
    const res = await fetchImpl(path, { credentials: 'same-origin', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers })
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || res.status === 401 || res.status === 403) {
      throw new SessionExpiredError()
    }
    if (!res.ok) throw new Error(`Schoology returned HTTP ${res.status} for ${path}`)
    return res
  }

  return {
    async getAjaxHtml(path) {
      const res = await request(path, { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' })
      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw new ScraperLayoutError(`Expected JSON from ${path}`)
      }
      const html = (body as { html?: unknown } | null)?.html
      if (typeof html !== 'string') throw new ScraperLayoutError(`Expected an html field from ${path}`)
      return html
    },
    async getPage(path) {
      return (await request(path, { Accept: 'text/html' })).text()
    },
  }
}
