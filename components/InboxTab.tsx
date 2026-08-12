'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScreenHeader } from '@/components/dashboard/screen-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { GoogleIcon } from '@/components/dashboard/google-icon'

interface Email {
  id: string
  from: string
  subject: string
  date: string
  unread: boolean
  snippet: string
}

function formatFrom(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.split('@')[0]
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function DebugMeasurements() {
  const [info, setInfo] = useState('')

  useEffect(() => {
    const id = setTimeout(() => {
      const vv = window.visualViewport
      setInfo(
        `screen ${window.innerWidth}px | page ${document.documentElement.scrollWidth}px | ` +
        `overflow ${document.documentElement.scrollWidth - window.innerWidth}px | ` +
        `scale ${vv ? vv.scale.toFixed(2) : 'n/a'} | dpr ${window.devicePixelRatio}`
      )
    }, 800)
    return () => clearTimeout(id)
  })

  if (!info) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 break-words bg-yellow-400 p-2 text-[11px] font-bold text-black">
      {info}
    </div>
  )
}

export default function InboxTab() {
  const { data: session } = useSession()
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    setLoading(true)
    fetch('/api/gmail')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setEmails(data.emails || [])
      })
      .catch(() => setError('Failed to load emails'))
      .finally(() => setLoading(false))
  }, [session])

  const unread = emails.filter(e => e.unread)
  const read = emails.filter(e => !e.unread)

  return (
    <div>
      <DebugMeasurements />
      <ScreenHeader title="Inbox" subtitle="Emails that matter to you" />

      {!session ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-8 pb-16 pt-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-muted text-primary-foreground">
            <Mail className="size-7" strokeWidth={2.25} aria-hidden="true" />
          </div>
          <p className="max-w-xs text-pretty text-base font-medium text-muted-foreground">
            Connect Gmail to see emails that matter to you
          </p>
          <button
            type="button"
            onClick={() => signIn('google')}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <GoogleIcon className="size-5" />
            Sign in with Google
          </button>
        </main>
      ) : (
        <div className="space-y-2.5 p-4">
          {loading && <p className="px-1 py-10 text-center text-sm text-muted-foreground">Loading emails...</p>}
          {error && <p className="px-1 py-10 text-center text-sm font-medium text-urgent">{error}</p>}

          {!loading && !error && (
            <>
              {unread.length > 0 && (
                <section aria-labelledby="inbox-unread-heading">
                  <SectionHeading title="Unread" />
                  <div id="inbox-unread-heading" className="space-y-2.5">
                    {unread.map(e => <EmailCard key={e.id} email={e} />)}
                  </div>
                </section>
              )}

              {read.length > 0 && (
                <section aria-labelledby="inbox-earlier-heading" className="mt-7">
                  <SectionHeading title="Earlier" />
                  <div id="inbox-earlier-heading" className="space-y-2.5">
                    {read.map(e => <EmailCard key={e.id} email={e} />)}
                  </div>
                </section>
              )}

              {emails.length === 0 && (
                <p className="px-1 py-10 text-center text-sm text-muted-foreground">No emails found.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Checks whether an element's own box extends past a boundary element's
// right edge - the real signal of broken layout, unlike scrollWidth vs
// clientWidth (which is naturally huge on any working ellipsis truncation).
function edgeOverflow(el: HTMLElement | null, boundary: HTMLElement | null) {
  if (!el || !boundary) return 0
  return Math.max(0, Math.round(el.getBoundingClientRect().right - boundary.getBoundingClientRect().right))
}

function EmailCard({ email }: { email: Email }) {
  const unread = email.unread
  const cardRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLParagraphElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const subjectRef = useRef<HTMLParagraphElement>(null)
  const snippetRef = useRef<HTMLParagraphElement>(null)
  const [report, setReport] = useState('')

  useEffect(() => {
    const id = setTimeout(() => {
      const card = cardRef.current
      const parts = [
        ['row', edgeOverflow(rowRef.current, card)],
        ['name', edgeOverflow(nameRef.current, card)],
        ['time', edgeOverflow(timeRef.current, card)],
        ['subj', edgeOverflow(subjectRef.current, card)],
        ['snip', edgeOverflow(snippetRef.current, card)],
      ] as const
      const overflowing = parts.filter(([, px]) => px > 2)
      setReport(overflowing.map(([label, px]) => `${label}+${px}px`).join(' '))
    }, 800)
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative flex items-start gap-3 overflow-hidden rounded-2xl bg-card p-3.5',
        unread && 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-xl',
          unread ? 'bg-brand-muted text-primary-foreground' : 'bg-secondary text-muted-foreground',
        )}
      >
        <Mail className="size-4" strokeWidth={2.25} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        {report ? (
          <div className="mb-1 break-words rounded bg-red-500 px-1 py-0.5 text-[10px] font-bold text-white">
            {report}
          </div>
        ) : null}
        <div ref={rowRef} className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {unread ? (
              <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" role="img" />
            ) : null}
            <p ref={nameRef} className={cn('min-w-0 truncate text-sm', unread ? 'font-bold text-card-foreground' : 'font-medium text-foreground/80')}>
              {formatFrom(email.from)}
            </p>
          </div>
          <span ref={timeRef} className="shrink-0 text-xs font-medium text-muted-foreground">{formatDate(email.date)}</span>
        </div>

        <p ref={subjectRef} className={cn('mt-0.5 truncate text-sm', unread ? 'font-semibold text-card-foreground' : 'text-foreground/70')}>
          {email.subject}
        </p>
        <p ref={snippetRef} className="mt-0.5 truncate text-xs text-muted-foreground">{email.snippet}</p>
      </div>
    </div>
  )
}
