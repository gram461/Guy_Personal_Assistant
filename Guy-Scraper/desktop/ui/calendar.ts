import type { CalendarEvent } from './bridge'

// Everything here works in the computer's own time zone: "this week" and "today" are the ones on the wall.

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_MONTHS = MONTHS.map(m => m.slice(0, 3))
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Monday of the week `offset` weeks from the one containing `now`, at midnight.
export function weekStart(offset: number, now: Date): Date {
  const mondayBased = (now.getDay() + 6) % 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayBased + offset * 7)
}

export const weekRange = (offset: number, now: Date) => {
  const from = weekStart(offset, now)
  return { from, to: addDays(from, 7) }
}

export function weekLabel(from: Date): string {
  const last = addDays(from, 6)
  return from.getMonth() === last.getMonth()
    ? `${MONTHS[from.getMonth()]} ${from.getDate()} - ${last.getDate()}`
    : `${MONTHS[from.getMonth()]} ${from.getDate()} - ${MONTHS[last.getMonth()]} ${last.getDate()}`
}

export function agendaTitle(offset: number, from: Date): string {
  if (offset === 0) return 'This week'
  if (offset === 1) return 'Next week'
  if (offset === -1) return 'Last week'
  return `Week of ${SHORT_MONTHS[from.getMonth()]} ${from.getDate()}`
}

const hourMinute = (d: Date) => `${d.getHours() % 12 === 0 ? 12 : d.getHours() % 12}:${pad(d.getMinutes())}`
const meridiem = (d: Date) => (d.getHours() < 12 ? 'AM' : 'PM')

// "All day", "10:50 AM", or "3:30 - 5:00 PM" when it starts and ends on the same day.
export function timeText(event: CalendarEvent): string {
  if (event.allDay) return 'All day'
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (Number.isNaN(start.getTime())) return ''
  if (Number.isNaN(end.getTime()) || end <= start || dayKey(end) !== dayKey(start)) return `${hourMinute(start)} ${meridiem(start)}`
  return meridiem(start) === meridiem(end)
    ? `${hourMinute(start)} - ${hourMinute(end)} ${meridiem(end)}`
    : `${hourMinute(start)} ${meridiem(start)} - ${hourMinute(end)} ${meridiem(end)}`
}

export type DayCell = { key: string; num: number; isToday: boolean; hasEvents: boolean }
export type AgendaEvent = { id: string; title: string; detail: string }
export type AgendaGroup = { key: string; label: string; sub: string; isToday: boolean; events: AgendaEvent[] }

// The seven days of the week, plus what is on each of them. An all-day event covers every day it spans;
// a timed one belongs to the day it starts.
export function buildWeek(events: CalendarEvent[], from: Date, now: Date): { cells: DayCell[]; groups: AgendaGroup[] } {
  const today = dayKey(now)
  const byDay = new Map<string, CalendarEvent[]>()
  const put = (key: string, event: CalendarEvent) => byDay.set(key, [...(byDay.get(key) ?? []), event])

  for (const event of events) {
    if (event.allDay) {
      for (let day = parseKey(event.start), last = parseKey(event.end); day < last || dayKey(day) === event.start; day = addDays(day, 1)) put(dayKey(day), event)
    } else {
      const start = new Date(event.start)
      if (!Number.isNaN(start.getTime())) put(dayKey(start), event)
    }
  }

  const cells: DayCell[] = []
  const groups: AgendaGroup[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i)
    const key = dayKey(date)
    const here = byDay.get(key) ?? []
    cells.push({ key, num: date.getDate(), isToday: key === today, hasEvents: here.length > 0 })
    if (here.length === 0) continue

    // All-day events first, then by start time.
    const ordered = [...here].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start))
    groups.push({
      key,
      label: key === today ? 'Today' : LONG_DAYS[i],
      sub: key === today ? `${SHORT_DAYS[i]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}` : `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`,
      isToday: key === today,
      events: ordered.map(e => ({ id: `${key}-${e.id}`, title: e.title, detail: e.location ? `${timeText(e)} · ${e.location}` : timeText(e) })),
    })
  }
  return { cells, groups }
}
export const WEEKDAY_HEADERS = SHORT_DAYS
