import type { MailMessage } from './bridge'

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 24 * 60 * 60 * 1000

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const clock = (d: Date) => `${d.getHours() % 12 === 0 ? 12 : d.getHours() % 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
const daysAgo = (d: Date, now: Date) => Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS)

// The short time in the message list: the time today, "Yesterday", the weekday this week, then the date.
export function listTime(receivedAt: string, now: Date): string {
  const d = new Date(receivedAt)
  if (Number.isNaN(d.getTime())) return ''
  const ago = daysAgo(d, now)
  if (ago <= 0) return clock(d)
  if (ago === 1) return 'Yesterday'
  if (ago < 7) return SHORT_DAYS[d.getDay()]
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function fullTime(receivedAt: string, now: Date): string {
  const d = new Date(receivedAt)
  if (Number.isNaN(d.getTime())) return ''
  const ago = daysAgo(d, now)
  if (ago <= 0) return `Today, ${clock(d)}`
  if (ago === 1) return `Yesterday, ${clock(d)}`
  return `${SHORT_DAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${clock(d)}`
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 1) : parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase()
}

const PERSONAL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'live.com', 'aol.com', 'proton.me', 'protonmail.com'])
const domainOf = (address: string) => address.split('@')[1]?.toLowerCase() ?? ''

// "From school" means from the same organization as the person's own address, which only makes sense for a work or school address.
export const canFilterBySchool = (myEmail: string | null) => !!myEmail && !!domainOf(myEmail) && !PERSONAL_DOMAINS.has(domainOf(myEmail))

export function isFromSchool(message: MailMessage, myEmail: string | null): boolean {
  return canFilterBySchool(myEmail) && domainOf(message.fromAddress) === domainOf(myEmail as string)
}

// A link that opens this conversation in Gmail, signed in as the account the app is connected to.
export const gmailLink = (myEmail: string | null, threadId: string) =>
  `https://mail.google.com/mail/u/${encodeURIComponent(myEmail ?? '0')}/#inbox/${encodeURIComponent(threadId)}`
