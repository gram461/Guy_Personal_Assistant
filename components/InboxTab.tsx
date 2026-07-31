'use client'

import { useEffect, useState } from 'react'
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

function EmailCard({ email }: { email: Email }) {
  const unread = email.unread
  return (
    <div
      className={cn(
        'relative flex items-start gap-3 overflow-hidden rounded-2xl bg-card p-3.5',
        unread && 'before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary',
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          unread ? 'bg-brand-muted text-primary-foreground' : 'bg-secondary text-muted-foreground',
        )}
      >
        <Mail className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {unread ? (
              <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" role="img" />
            ) : null}
            <p className={cn('truncate text-sm', unread ? 'font-bold text-card-foreground' : 'font-medium text-foreground/80')}>
              {formatFrom(email.from)}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatDate(email.date)}</span>
        </div>

        <p className={cn('mt-0.5 truncate text-sm', unread ? 'font-semibold text-card-foreground' : 'text-foreground/70')}>
          {email.subject}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{email.snippet}</p>
      </div>
    </div>
  )
}
