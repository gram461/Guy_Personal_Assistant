import { describe, expect, it } from 'vitest'
import { agendaTitle, buildWeek, dayKey, timeText, weekLabel, weekRange, weekStart } from '../desktop/ui/calendar'
import type { CalendarEvent, MailMessage } from '../desktop/ui/bridge'
import { canFilterBySchool, fullTime, gmailLink, initials, isFromSchool, listTime } from '../desktop/ui/mail'

// Dates are built from local parts, so these hold in any time zone.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)
const timed = (id: string, title: string, start: Date, end: Date, location = ''): CalendarEvent => ({ id, title, start: start.toISOString(), end: end.toISOString(), allDay: false, location })
const allDay = (id: string, title: string, start: string, end: string): CalendarEvent => ({ id, title, start, end, allDay: true, location: '' })

describe('weeks', () => {
  const wed = at(2026, 11, 11, 12)

  it('starts on Monday, and moves by whole weeks', () => {
    expect(dayKey(weekStart(0, wed))).toBe('2026-11-09')
    expect(dayKey(weekStart(1, wed))).toBe('2026-11-16')
    expect(dayKey(weekStart(-1, wed))).toBe('2026-11-02')
    expect(dayKey(weekStart(0, at(2026, 11, 15, 23, 59)))).toBe('2026-11-09')
    expect(dayKey(weekStart(0, at(2026, 11, 16)))).toBe('2026-11-16')
  })

  it('covers seven days, even across a month or a clock change', () => {
    const { from, to } = weekRange(0, at(2026, 11, 1, 10))
    expect([dayKey(from), dayKey(to)]).toEqual(['2026-10-26', '2026-11-02'])
    expect(dayKey(weekRange(0, at(2026, 3, 11)).to)).toBe('2026-03-16')
  })

  it('labels the week and the agenda', () => {
    expect(weekLabel(at(2026, 11, 9))).toBe('November 9 - 15')
    expect(weekLabel(at(2026, 10, 26))).toBe('October 26 - November 1')
    expect([0, 1, -1].map(o => agendaTitle(o, at(2026, 11, 9)))).toEqual(['This week', 'Next week', 'Last week'])
    expect(agendaTitle(3, at(2026, 11, 30))).toBe('Week of Nov 30')
  })
})

describe('timeText', () => {
  it('shows all day, a start, or a range', () => {
    expect(timeText(allDay('a', 'x', '2026-11-26', '2026-11-27'))).toBe('All day')
    expect(timeText(timed('b', 'x', at(2026, 11, 11, 10, 50), at(2026, 11, 11, 10, 50)))).toBe('10:50 AM')
    expect(timeText(timed('c', 'x', at(2026, 11, 11, 15, 30), at(2026, 11, 11, 17, 0)))).toBe('3:30 - 5:00 PM')
    expect(timeText(timed('d', 'x', at(2026, 11, 11, 11, 30), at(2026, 11, 11, 13, 0)))).toBe('11:30 AM - 1:00 PM')
    expect(timeText(timed('e', 'x', at(2026, 11, 11, 0, 5), at(2026, 11, 11, 0, 30)))).toBe('12:05 - 12:30 AM')
    expect(timeText(timed('f', 'x', at(2026, 11, 11, 22, 0), at(2026, 11, 12, 1, 0)))).toBe('10:00 PM')
  })
})

describe('buildWeek', () => {
  const from = at(2026, 11, 9)
  const now = at(2026, 11, 11, 9)
  const events = [
    timed('r', 'Robotics club', at(2026, 11, 11, 15, 30), at(2026, 11, 11, 17, 0), 'Room 214'),
    timed('w', 'Wellness', at(2026, 11, 11, 10, 50), at(2026, 11, 11, 11, 20)),
    allDay('t', 'Conferences', '2026-11-11', '2026-11-12'),
    allDay('b', 'Break', '2026-11-13', '2026-11-16'),
  ]

  it('marks today and the days that have something on', () => {
    const { cells } = buildWeek(events, from, now)
    expect(cells.map(c => c.num)).toEqual([9, 10, 11, 12, 13, 14, 15])
    expect(cells.filter(c => c.isToday).map(c => c.num)).toEqual([11])
    expect(cells.filter(c => c.hasEvents).map(c => c.num)).toEqual([11, 13, 14, 15])
  })

  it('groups by day with all-day first, then by time, and a place after the time', () => {
    const { groups } = buildWeek(events, from, now)
    expect(groups[0]).toMatchObject({ label: 'Today', sub: 'Wed, Nov 11', isToday: true })
    expect(groups[0].events.map(e => [e.title, e.detail])).toEqual([['Conferences', 'All day'], ['Wellness', '10:50 - 11:20 AM'], ['Robotics club', '3:30 - 5:00 PM · Room 214']])
    expect(groups.slice(1).map(g => [g.label, g.sub])).toEqual([['Friday', 'Nov 13'], ['Saturday', 'Nov 14'], ['Sunday', 'Nov 15']])
  })

  it('is empty for a quiet week', () => {
    const { groups, cells } = buildWeek([], from, now)
    expect(groups).toEqual([])
    expect(cells.every(c => !c.hasEvents)).toBe(true)
  })
})

describe('mail labels', () => {
  const now = at(2026, 11, 11, 12)
  const iso = (d: Date) => d.toISOString()

  it('shows the time today, then Yesterday, the weekday, then the date', () => {
    expect(listTime(iso(at(2026, 11, 11, 8, 41)), now)).toBe('8:41 AM')
    expect(listTime(iso(at(2026, 11, 10, 16, 15)), now)).toBe('Yesterday')
    expect(listTime(iso(at(2026, 11, 9, 15, 10)), now)).toBe('Mon')
    expect(listTime(iso(at(2026, 11, 2, 15, 10)), now)).toBe('Nov 2')
    expect(listTime('nonsense', now)).toBe('')
    expect(fullTime(iso(at(2026, 11, 11, 8, 41)), now)).toBe('Today, 8:41 AM')
    expect(fullTime(iso(at(2026, 11, 10, 16, 15)), now)).toBe('Yesterday, 4:15 PM')
    expect(fullTime(iso(at(2026, 11, 6, 14, 45)), now)).toBe('Fri, Nov 6, 2:45 PM')
  })

  it('makes initials', () => {
    expect(initials('Ms. Alvarez')).toBe('MA')
    expect(initials('Schoology')).toBe('S')
    expect(initials('Homestead Counseling')).toBe('HC')
    expect(initials('')).toBe('?')
    expect(initials('<>')).toBe('?')
  })

  it('offers From school only for a school or work address', () => {
    const msg = (address: string): MailMessage => ({ id: '1', threadId: 't', fromName: 'x', fromAddress: address, subject: 's', snippet: '', receivedAt: '', unread: false })
    expect(canFilterBySchool('me@school.example')).toBe(true)
    expect(canFilterBySchool('me@gmail.com')).toBe(false)
    expect(canFilterBySchool(null)).toBe(false)
    expect(isFromSchool(msg('Teacher@School.example'), 'me@school.example')).toBe(true)
    expect(isFromSchool(msg('x@pantry.example'), 'me@school.example')).toBe(false)
    expect(isFromSchool(msg('x@gmail.com'), 'me@gmail.com')).toBe(false)
  })

  it('builds a link to the conversation in the right Google account', () => {
    expect(gmailLink('me@school.example', 'abc123')).toBe('https://mail.google.com/mail/u/me%40school.example/#inbox/abc123')
    expect(gmailLink(null, 'x')).toBe('https://mail.google.com/mail/u/0/#inbox/x')
  })
})
