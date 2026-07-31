'use client'

import { useState, useEffect } from 'react'
import AddEventModal from './AddEventModal'
import { colors, headerColors, badge as badgeColors, sectionLabelStyle, cardStyle } from '@/lib/theme'
import { daysUntil } from '@/lib/summaryFilters'

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

function badgeStyle(days: number): React.CSSProperties {
  if (days <= 1) return badgeColors.red
  if (days <= 3) return badgeColors.amber
  return badgeColors.blue
}

function accentColor(days: number) {
  if (days <= 1) return badgeColors.red.accent
  if (days <= 3) return badgeColors.amber.accent
  return badgeColors.blue.accent
}

export default function SchoolTab() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
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

  return (
    <div>
      <div style={{ background: headerColors.navy, padding: '20px 20px 16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>School</p>
          <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Live from Schoology</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <p style={{ color: colors.textSecondary, fontSize: 14 }}>Loading your Schoology assignments...</p>}
        {error && <p style={{ color: badgeColors.red.color, fontSize: 14 }}>{error}</p>}

        {!loading && !error && (<>
          {soon.length > 0 && <>
            <p style={sectionLabelStyle}>Today & tomorrow</p>
            {soon.map((e, i) => <EventCard key={i} event={e} />)}
          </>}

          {week.length > 0 && <>
            <p style={sectionLabelStyle}>This week</p>
            {week.map((e, i) => <EventCard key={i} event={e} />)}
          </>}

          {events.length === 0 && <p style={{ color: colors.textSecondary, fontSize: 14 }}>No upcoming assignments in the next 2 weeks.</p>}
        </>)}

        {added.map((e, i) => (
          <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${badgeColors.blue.accent}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>{e.title}</p>
              <p style={{ fontSize: 12, color: colors.textSecondary, margin: '3px 0 0' }}>{e.sub}</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, ...badgeColors.blue }}>Added</span>
          </div>
        ))}
      </div>

      {showModal && <AddEventModal type="school" onClose={() => setShowModal(false)} onAdd={e => { setAdded(p => [...p, e]); setShowModal(false) }} />}
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const days = daysUntil(event.date)
  const date = new Date(event.date)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = formatTime(event.date)

  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${accentColor(days)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>{event.title}</p>
        <p style={{ fontSize: 12, color: colors.textSecondary, margin: '3px 0 0' }}>{dateStr} · {time || 'All day'} · Schoology</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle(days) }}>{badgeLabel(days)}</span>
    </div>
  )
}
