import { ScraperLayoutError, SessionExpiredError } from './errors'

const ORIGIN = 'https://fuhsd.schoology.com'
const TIMEOUT_MS = 15_000
const DELAY_BETWEEN_REQUESTS_MS = 1_000

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function createSchoologyClient(session: string, options: { delayMs?: number } = {}) {
  const delayMs = options.delayMs ?? DELAY_BETWEEN_REQUESTS_MS
  let hasRequested = false

  async function request(path: string, headers: Record<string, string>): Promise<Response> {
    if (!path.startsWith('/')) throw new Error('Schoology paths must be relative to the school site')
    if (hasRequested) await wait(delayMs)
    hasRequested = true

    // Redirects are not followed: they point at the login page, and the session cookie must not travel with them.
    const res = await fetch(ORIGIN + path, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Cookie: session, 'User-Agent': 'Guy-Scraper/1.0', ...headers },
    })

    if ((res.status >= 300 && res.status < 400) || res.status === 401 || res.status === 403) {
      throw new SessionExpiredError()
    }
    if (!res.ok) throw new Error(`Schoology returned HTTP ${res.status} for ${path}`)
    return res
  }

  async function getAjaxHtml(path: string): Promise<string> {
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
  }

  async function getPage(path: string): Promise<string> {
    const res = await request(path, { Accept: 'text/html' })
    return res.text()
  }

  return { getAjaxHtml, getPage }
}
