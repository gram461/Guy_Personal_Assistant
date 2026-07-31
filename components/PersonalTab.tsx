'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { CalendarCheck, Plus } from 'lucide-react'
import { daysUntil } from '@/lib/summaryFilters'
import { ScreenHeader } from '@/components/dashboard/screen-header'
import { ListCard } from '@/components/dashboard/list-card'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { Tag } from '@/components/dashboard/tag'
import { AddAssignmentSheet, type NewAssignment } from '@/components/dashboard/add-assignment-sheet'
import { GoogleIcon } from '@/components/dashboard/google-icon'

type Event = { title: string; date: string; location: string }

function formatTime(dateStr: string) {
  if (!dateStr.includes('T')) return null
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function badgeLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function tone(days: number): 'success' | 'warning' | 'brand' {
  if (days <= 1) return 'success'
  if (days <= 3) return 'warning'
  return 'brand'
}

export default function PersonalTab() {
  const { data: session } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [added, setAdded] = useState<{ title: string; sub: string }[]>([])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    fetch('/api/calendar')
      .then(r => r.json())
      .then(data => { setEvents(data.events || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session])

  const today = events.filter(e => daysUntil(e.date) === 0)
  const week = events.filter(e => daysUntil(e.date) > 0)

  function addManualEvent({ title, description }: NewAssignment) {
    setAdded(prev => [...prev, { title, sub: description || 'Added by you' }])
  }

  return (
    <div>
      <ScreenHeader title="Personal" subtitle="Your events & family calendar" />

      {!session ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-8 pb-16 pt-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-muted text-primary-foreground">
            <CalendarCheck className="size-7" strokeWidth={2.25} aria-hidden="true" />
          </div>
          <p className="max-w-xs text-pretty text-base font-medium text-muted-foreground">
            Connect Google Calendar to see your events
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
        <>
          <div className="space-y-2.5 p-4">
            {loading && <p className="px-1 py-10 text-center text-sm text-muted-foreground">Loading your calendar...</p>}

            {!loading && today.length > 0 && (
              <section aria-labelledby="personal-today-heading">
                <SectionHeading title="Today" />
                <div id="personal-today-heading" className="space-y-2.5">
                  {today.map((e, i) => <EventCard key={i} event={e} />)}
                </div>
              </section>
            )}

            {!loading && week.length > 0 && (
              <section aria-labelledby="personal-week-heading" className="mt-7">
                <SectionHeading title="This week" />
                <div id="personal-week-heading" className="space-y-2.5">
                  {week.map((e, i) => <EventCard key={i} event={e} />)}
                </div>
              </section>
            )}

            {!loading && events.length === 0 && added.length === 0 && (
              <p className="px-1 py-10 text-center text-sm text-muted-foreground">No upcoming events in the next 2 weeks.</p>
            )}

            {added.length > 0 && (
              <div className="mt-7 space-y-2.5">
                {added.map((e, i) => (
                  <ListCard
                    key={i}
                    icon={CalendarCheck}
                    iconTone="success"
                    accentEdge="success"
                    title={e.title}
                    subtitle={e.sub}
                    right={<Tag tone="success">Added</Tag>}
                  />
                ))}
              </div>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign out of Google
              </button>
            </div>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Add event"
              className="pointer-events-auto absolute bottom-24 right-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      <AddAssignmentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={addManualEvent}
        heading="New event"
        submitLabel="Add event"
        nameLabel="Title"
        namePlaceholder="e.g. Dinner with Mom"
        emptyNameError="Give your event a title."
      />
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const days = daysUntil(event.date)
  const date = new Date(event.date)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = formatTime(event.date)
  const t = tone(days)

  return (
    <ListCard
      icon={CalendarCheck}
      iconTone={t}
      accentEdge={t}
      title={event.title}
      subtitle={`${dateStr} · ${time || 'All day'} · Google Calendar`}
      right={<Tag tone={t}>{badgeLabel(days)}</Tag>}
    />
  )
}
