import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeSnippet, fetchCalendarRange, fetchInbox, parseSender } from '../google/api'
import { GoogleTokenRejectedError } from '../google/types'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn()
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockReset() })
const use = () => vi.stubGlobal('fetch', fetchMock)

describe('fetchCalendarRange', () => {
  it('asks for the range, expanded into single events, and maps timed and all-day events', async () => {
    use()
    fetchMock.mockResolvedValue(json({ items: [
      { id: 'a', summary: 'Robotics club', location: 'Room 214', start: { dateTime: '2026-11-11T15:30:00-08:00' }, end: { dateTime: '2026-11-11T17:00:00-08:00' } },
      { id: 'b', start: { date: '2026-11-26' }, end: { date: '2026-11-27' } },
      { id: 'c' },
    ] }))
    const events = await fetchCalendarRange('tok', new Date('2026-11-09T00:00:00Z'), new Date('2026-11-16T00:00:00Z'))

    expect(events).toEqual([
      { id: 'a', title: 'Robotics club', start: '2026-11-11T15:30:00-08:00', end: '2026-11-11T17:00:00-08:00', allDay: false, location: 'Room 214' },
      { id: 'b', title: 'Untitled', start: '2026-11-26', end: '2026-11-27', allDay: true, location: '' },
    ])
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('timeMin')).toBe('2026-11-09T00:00:00.000Z')
    expect(url.searchParams.get('singleEvents')).toBe('true')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  it('reports a rejected token as one, and other failures without Google’s own text', async () => {
    use()
    fetchMock.mockResolvedValueOnce(json({}, 401))
    await expect(fetchCalendarRange('t', new Date(), new Date())).rejects.toThrow(GoogleTokenRejectedError)
    fetchMock.mockResolvedValueOnce(new Response('secret details', { status: 500 }))
    await expect(fetchCalendarRange('t', new Date(), new Date())).rejects.toThrow('Google Calendar answered 500')
  })
})

describe('parsing helpers', () => {
  it('splits a sender into name and address', () => {
    expect(parseSender('Ms. Alvarez <m.alvarez@school.example>')).toEqual({ name: 'Ms. Alvarez', address: 'm.alvarez@school.example' })
    expect(parseSender('"Counseling, Homestead" <c@school.example>')).toEqual({ name: 'Counseling, Homestead', address: 'c@school.example' })
    expect(parseSender('<noreply@x.example>')).toEqual({ name: 'noreply@x.example', address: 'noreply@x.example' })
    expect(parseSender('plain@x.example')).toEqual({ name: 'plain@x.example', address: 'plain@x.example' })
    expect(parseSender('Just A Name')).toEqual({ name: 'Just A Name', address: '' })
  })

  it('decodes the entities Gmail puts in previews', () => {
    expect(decodeSnippet('Tom &amp; Jerry&#39;s &quot;test&quot; &lt;3')).toBe('Tom & Jerry\'s "test" <3')
  })
})

describe('fetchInbox', () => {
  const list = (ids: string[]) => json({ messages: ids.map(id => ({ id })) })
  const message = (over: object = {}) => json({
    threadId: 't1', snippet: 'Hi there &amp; welcome', internalDate: String(Date.parse('2026-11-11T16:41:00Z')), labelIds: ['INBOX', 'UNREAD'],
    payload: { headers: [{ name: 'From', value: 'Ms. Alvarez <m@school.example>' }, { name: 'Subject', value: 'Lab 4' }] }, ...over,
  })

  it('reads sender, subject, time, preview and unread state, newest first', async () => {
    use()
    fetchMock.mockResolvedValueOnce(list(['1', '2']))
      .mockResolvedValueOnce(message({ internalDate: String(Date.parse('2026-11-10T10:00:00Z')), labelIds: ['INBOX'] }))
      .mockResolvedValueOnce(message())
    const result = await fetchInbox('tok')
    expect(result.map(m => m.id)).toEqual(['2', '1'])
    expect(result[0]).toEqual({
      id: '2', threadId: 't1', fromName: 'Ms. Alvarez', fromAddress: 'm@school.example', subject: 'Lab 4',
      snippet: 'Hi there & welcome', receivedAt: '2026-11-11T16:41:00.000Z', unread: true,
    })
    expect(result[1].unread).toBe(false)
    expect(String(fetchMock.mock.calls[1][0])).toContain('format=metadata')
  })

  it('leaves out a message that failed, instead of showing a blank row', async () => {
    use()
    fetchMock.mockResolvedValueOnce(list(['1', '2'])).mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(message())
    expect((await fetchInbox('t')).map(m => m.id)).toEqual(['2'])
  })

  it('reports a problem when none could be loaded, and is fine with an empty inbox', async () => {
    use()
    fetchMock.mockResolvedValueOnce(list(['1', '2'])).mockResolvedValue(json({}, 500))
    await expect(fetchInbox('t')).rejects.toThrow('could not be loaded')
    fetchMock.mockReset().mockResolvedValueOnce(json({}))
    expect(await fetchInbox('t')).toEqual([])
  })

  it('reports a rejected token whether the list or a message is refused', async () => {
    use()
    fetchMock.mockResolvedValueOnce(json({}, 401))
    await expect(fetchInbox('t')).rejects.toThrow(GoogleTokenRejectedError)
    fetchMock.mockReset().mockResolvedValueOnce(list(['1'])).mockResolvedValueOnce(json({}, 401))
    await expect(fetchInbox('t')).rejects.toThrow(GoogleTokenRejectedError)
  })
})
