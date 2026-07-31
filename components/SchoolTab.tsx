'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Plus } from 'lucide-react'
import { daysUntil } from '@/lib/summaryFilters'
import { ScreenHeader } from '@/components/dashboard/screen-header'
import { ListCard } from '@/components/dashboard/list-card'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { Tag } from '@/components/dashboard/tag'
import { AddAssignmentSheet, type NewAssignment } from '@/components/dashboard/add-assignment-sheet'

type Event = { title: string; date: string; description: string }

function formatTime(dateStr: string) {
  if (!dateStr.includes('T')) return null
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function badgeLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function tone(days: number): 'urgent' | 'warning' | 'brand' {
  if (days <= 1) return 'urgent'
  if (days <= 3) return 'warning'
  return 'brand'
}

export default function SchoolTab() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [added, setAdded] = useState<{ title: string; sub: string }[]>([])

  useEffect(() => {
    fetch('/api/schoology')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setEvents(data.events)
        setLoading(false)
      })
      .catch(() => { setError('Could not load Schoology data'); setLoading(false) })
  }, [])

  const soon = events.filter(e => daysUntil(e.date) <= 2)
  const week = events.filter(e => daysUntil(e.date) > 2)

  function addManualAssignment({ title, description, dueDate }: NewAssignment) {
    setAdded(prev => [...prev, { title, sub: description || 'Added by you' }])
  }

  return (
    <div>
      <ScreenHeader title="School" subtitle="Live from Schoology" />

      <div className="space-y-2.5 p-4">
        {loading && <p className="px-1 py-10 text-center text-sm text-muted-foreground">Loading your Schoology assignments...</p>}
        {error && <p className="px-1 py-10 text-center text-sm font-medium text-urgent">{error}</p>}

        {!loading && !error && (
          <>
            {soon.length > 0 && (
              <section aria-labelledby="soon-heading">
                <SectionHeading title="Today & tomorrow" />
                <div id="soon-heading" className="space-y-2.5">
                  {soon.map((e, i) => <AssignmentCard key={i} event={e} />)}
                </div>
              </section>
            )}

            {week.length > 0 && (
              <section aria-labelledby="week-heading" className="mt-7">
                <SectionHeading title="This week" />
                <div id="week-heading" className="space-y-2.5">
                  {week.map((e, i) => <AssignmentCard key={i} event={e} />)}
                </div>
              </section>
            )}

            {events.length === 0 && added.length === 0 && (
              <p className="px-1 py-10 text-center text-sm text-muted-foreground">No upcoming assignments in the next 2 weeks.</p>
            )}
          </>
        )}

        {added.length > 0 && (
          <div className="mt-7 space-y-2.5">
            {added.map((e, i) => (
              <ListCard
                key={i}
                icon={GraduationCap}
                iconTone="brand"
                accentEdge="brand"
                title={e.title}
                subtitle={e.sub}
                right={<Tag tone="brand">Added</Tag>}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Add assignment"
          className="pointer-events-auto absolute bottom-24 right-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
        >
          <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <AddAssignmentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={addManualAssignment}
      />
    </div>
  )
}

function AssignmentCard({ event }: { event: Event }) {
  const days = daysUntil(event.date)
  const date = new Date(event.date)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = formatTime(event.date)
  const t = tone(days)

  return (
    <ListCard
      icon={GraduationCap}
      iconTone={t}
      accentEdge={t}
      title={event.title}
      subtitle={`${dateStr} · ${time || 'All day'} · Schoology`}
      right={<Tag tone={t}>{badgeLabel(days)}</Tag>}
    />
  )
}
