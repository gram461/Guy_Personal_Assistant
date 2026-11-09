import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rows = vi.hoisted(() => new Map<string, string>())

vi.mock('../supabaseServer', () => ({
  supabaseServer: {
    from: () => ({
      upsert: async (row: { user_id: string; refresh_token_encrypted: string }) => {
        rows.set(row.user_id, row.refresh_token_encrypted)
        return { error: null }
      },
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: async () => ({ data: rows.has(id) ? { refresh_token_encrypted: rows.get(id) } : null }),
        }),
      }),
      delete: () => ({
        eq: async (_column: string, id: string) => {
          rows.delete(id)
          return { error: null }
        },
      }),
    }),
  },
}))

process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
process.env.GOOGLE_CLIENT_ID = 'client'
process.env.GOOGLE_CLIENT_SECRET = 'secret'

const { fetchGmailMessages } = await import('../gmail')
const { GoogleTokenRejectedError, withGoogleAccess } = await import('../googleApi')
const { fetchCalendarEvents } = await import('../googleCalendar')
const { GoogleReconnectError, GoogleUnavailableError, getFreshGoogleAccessToken, getGoogleAccessToken, saveGoogleRefreshToken } = await import('../googleTokenRefresh')

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn()
let n = 0
const newUser = () => `user-${++n}`

beforeEach(() => {
  rows.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe('getGoogleAccessToken', () => {
  it('asks for a new sign-in when none was ever saved, without calling Google', async () => {
    await expect(getGoogleAccessToken(newUser())).rejects.toThrow(GoogleReconnectError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores the refresh token encrypted', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'refresh-secret-123')
    expect(rows.get(user)).toBeDefined()
    expect(rows.get(user)).not.toContain('refresh-secret-123')
  })

  it('gets an access token from the saved sign-in and reuses it until it is about to expire', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'refresh-1')
    fetchMock.mockResolvedValue(json({ access_token: 'access-1', expires_in: 3600 }))

    expect(await getGoogleAccessToken(user)).toBe('access-1')
    expect(await getGoogleAccessToken(user)).toBe('access-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][1].body)).toContain('refresh_token=refresh-1')
  })

  it('fetches a new one once the cached one is nearly expired', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'refresh-1')
    fetchMock.mockResolvedValueOnce(json({ access_token: 'short', expires_in: 60 })).mockResolvedValueOnce(json({ access_token: 'next', expires_in: 3600 }))

    expect(await getGoogleAccessToken(user)).toBe('short')
    expect(await getGoogleAccessToken(user)).toBe('next')
  })

  it('forgets a sign-in Google says is dead and asks the person to reconnect, instead of failing quietly each time', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'revoked')
    fetchMock.mockResolvedValue(json({ error: 'invalid_grant' }, 400))

    await expect(getGoogleAccessToken(user)).rejects.toThrow(GoogleReconnectError)
    expect(rows.has(user)).toBe(false)

    fetchMock.mockClear()
    await expect(getGoogleAccessToken(user)).rejects.toThrow(GoogleReconnectError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the saved sign-in when Google is only having a problem', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'fine')
    fetchMock.mockResolvedValueOnce(json({ error: 'backend_error' }, 503))
    await expect(getGoogleAccessToken(user)).rejects.toThrow(GoogleUnavailableError)

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(getGoogleAccessToken(user)).rejects.toThrow(GoogleUnavailableError)
    expect(rows.has(user)).toBe(true)
  })

  it('gives background jobs null instead of an error when Google is not connected', async () => {
    expect(await getFreshGoogleAccessToken(newUser())).toBeNull()
  })
})

describe('withGoogleAccess', () => {
  it('tries once more with a fresh token when Google rejects the one it used', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'refresh')
    fetchMock.mockResolvedValueOnce(json({ access_token: 'old', expires_in: 3600 })).mockResolvedValueOnce(json({ access_token: 'new', expires_in: 3600 }))

    const used: string[] = []
    const result = await withGoogleAccess(user, async token => {
      used.push(token)
      if (token === 'old') throw new GoogleTokenRejectedError()
      return 'done'
    })
    expect(result).toBe('done')
    expect(used).toEqual(['old', 'new'])
  })

  it('asks for a new sign-in when Google rejects the fresh token too', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'refresh')
    fetchMock.mockImplementation(async () => json({ access_token: 'bad', expires_in: 3600 }))
    await expect(withGoogleAccess(user, async () => { throw new GoogleTokenRejectedError() })).rejects.toThrow(GoogleReconnectError)
  })

  it('passes other errors through without retrying', async () => {
    const user = newUser()
    await saveGoogleRefreshToken(user, 'refresh')
    fetchMock.mockResolvedValue(json({ access_token: 'ok', expires_in: 3600 }))
    const run = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withGoogleAccess(user, run)).rejects.toThrow('boom')
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('fetchCalendarEvents', () => {
  it('reads the events, with a title and date for each', async () => {
    fetchMock.mockResolvedValue(json({ items: [{ summary: 'Robotics', start: { dateTime: '2026-11-09T15:30:00-08:00' }, location: 'Room 214' }, { start: { date: '2026-11-10' } }] }))
    expect(await fetchCalendarEvents('t')).toEqual([
      { title: 'Robotics', date: '2026-11-09T15:30:00-08:00', location: 'Room 214' },
      { title: 'Untitled', date: '2026-11-10', location: '' },
    ])
  })

  it('reports a rejected token as one, and other failures as plain errors without Google’s text', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401))
    await expect(fetchCalendarEvents('t')).rejects.toThrow(GoogleTokenRejectedError)
    fetchMock.mockResolvedValueOnce(new Response('secret details from Google', { status: 500 }))
    await expect(fetchCalendarEvents('t')).rejects.toThrow('Google Calendar answered 500')
  })
})

describe('fetchGmailMessages', () => {
  const list = (ids: string[]) => json({ messages: ids.map(id => ({ id })) })
  const message = (subject: string, labels: string[] = []) => json({ snippet: 'hi', labelIds: labels, payload: { headers: [{ name: 'Subject', value: subject }, { name: 'From', value: 'a@b.c' }] } })

  it('reads the inbox with sender, subject and unread state', async () => {
    fetchMock.mockResolvedValueOnce(list(['1', '2'])).mockResolvedValueOnce(message('One', ['UNREAD'])).mockResolvedValueOnce(message('Two'))
    const result = await fetchGmailMessages('t')
    expect(result.map(m => [m.id, m.subject, m.unread])).toEqual([['1', 'One', true], ['2', 'Two', false]])
  })

  it('leaves out a message that failed to load instead of showing a blank row', async () => {
    fetchMock.mockResolvedValueOnce(list(['1', '2'])).mockResolvedValueOnce(json({ error: 'gone' }, 404)).mockResolvedValueOnce(message('Two'))
    const result = await fetchGmailMessages('t')
    expect(result.map(m => m.id)).toEqual(['2'])
  })

  it('reports a problem when none of the messages could be loaded', async () => {
    fetchMock.mockResolvedValueOnce(list(['1', '2'])).mockResolvedValue(json({}, 500))
    await expect(fetchGmailMessages('t')).rejects.toThrow('could not be loaded')
  })

  it('is fine with an empty inbox', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    expect(await fetchGmailMessages('t')).toEqual([])
  })

  it('reports a rejected token whether the list or a message is refused', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401))
    await expect(fetchGmailMessages('t')).rejects.toThrow(GoogleTokenRejectedError)
    fetchMock.mockResolvedValueOnce(list(['1'])).mockResolvedValueOnce(json({}, 401))
    await expect(fetchGmailMessages('t')).rejects.toThrow(GoogleTokenRejectedError)
  })
})
