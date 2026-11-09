// Schoology due dates are Pacific school days, so "today" is the Pacific day whatever this computer's time zone is.
const TZ = 'America/Los_Angeles'
const DAY_MS = 24 * 60 * 60 * 1000

export const dateKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: TZ })

const utcOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export const daysBetween = (from: string, to: string) => Math.round((utcOf(to) - utcOf(from)) / DAY_MS)
export const addDays = (key: string, days: number) => new Date(utcOf(key) + days * DAY_MS).toISOString().slice(0, 10)

const inUtc = (key: string, options: Intl.DateTimeFormatOptions) => new Date(utcOf(key)).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })

export const weekdayShort = (key: string) => inUtc(key, { weekday: 'short' })
export const dayNumber = (key: string) => String(Number(key.slice(8, 10)))
export const shortDate = (key: string) => inUtc(key, { weekday: 'short', month: 'short', day: 'numeric' })

// "23:59" -> "11:59 PM"
export function timeLabel(time: string | null): string {
  const match = time?.match(/^(\d{2}):(\d{2})$/)
  if (!match) return 'All day'
  const hour = Number(match[1])
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

export const todayLong = (now: Date) => now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })

export function greeting(now: Date): string {
  const hour = Number(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }).slice(0, 2)) % 24
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export function syncedLabel(iso: string | null, now: Date): string {
  if (!iso) return 'Not synced yet'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'Not synced yet'
  if (now.getTime() - at.getTime() < 60_000) return 'Synced just now'
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  if (dateKey(at) === dateKey(now)) return `Synced ${time}`
  return `Synced ${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })}, ${time}`
}
