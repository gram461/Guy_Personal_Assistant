import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSchoologyClient } from '../client'
import { ScraperLayoutError, SessionExpiredError } from '../errors'

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('createSchoologyClient', () => {
  it('sends the session only to the school site and does not follow redirects', async () => {
    const fetchMock = stubFetch(new Response('<html></html>'))
    await createSchoologyClient('SESSabc=123').getPage('/grades/grades')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://fuhsd.schoology.com/grades/grades')
    expect(options.redirect).toBe('manual')
    expect(options.headers.Cookie).toBe('SESSabc=123')
  })

  it('refuses paths that could point at another site', async () => {
    const fetchMock = stubFetch(new Response(''))
    await expect(createSchoologyClient('s').getPage('https://example.com/')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads the html field from ajax responses', async () => {
    stubFetch(new Response(JSON.stringify({ html: '<div></div>' })))
    await expect(createSchoologyClient('s').getAjaxHtml('/home/x')).resolves.toBe('<div></div>')
  })

  it.each([302, 401, 403])('treats HTTP %i as an expired session', async status => {
    stubFetch(new Response(null, { status }))
    await expect(createSchoologyClient('s').getPage('/grades/grades')).rejects.toThrow(SessionExpiredError)
  })

  it('reports other HTTP errors with the status and no page contents', async () => {
    stubFetch(new Response('secret page body', { status: 500 }))
    await expect(createSchoologyClient('s').getPage('/grades/grades')).rejects.toThrow('HTTP 500 for /grades/grades')
  })

  it('fails loudly when an ajax response is not what we expect', async () => {
    stubFetch(new Response('<html>login</html>'))
    await expect(createSchoologyClient('s').getAjaxHtml('/home/x')).rejects.toThrow(ScraperLayoutError)
    stubFetch(new Response(JSON.stringify({ other: 1 })))
    await expect(createSchoologyClient('s').getAjaxHtml('/home/x')).rejects.toThrow(ScraperLayoutError)
  })
})
