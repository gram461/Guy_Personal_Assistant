'use client'

import { useState, useEffect } from 'react'
import AddEventModal from './AddEventModal'

type Event = { title: string; date: string; description: string }

function daysUntil(dateStr: string) {
  const now = new Date()
  const then = new Date(dateStr)
  const diff = Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function badgeLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function badgeStyle(days: number): React.CSSProperties {
  if (days <= 1) return { background: '#FCEBEB', color: '#A32D2D' }
  if (days <= 3) return { background: '#FAEEDA', color: '#854F0B' }
  return { background: '#E6F1FB', color: '#185FA5' }
}

function accentColor(days: number) {
  if (days <= 1) return '#E24B4A'
  if (days <= 3) return '#BA7517'
  return '#185FA5'
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#aaa',
  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px'
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
      <div style={{ background: '#1a1a2e', padding: '20px 20px 16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>School</p>
          <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Live from Schoology</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <p style={{ color: '#aaa', fontSize: 14 }}>Loading your Schoology assignments...</p>}
        {error && <p style={{ color: '#A32D2D', fontSize: 14 }}>{error}</p>}

        {!loading && !error && (<>
          {soon.length > 0 && <>
            <p style={sectionLabel}>Today & tomorrow</p>
            {soon.map((e, i) => <EventCard key={i} event={e} />)}
          </>}

          {week.length > 0 && <>
            <p style={sectionLabel}>This week</p>
            {week.map((e, i) => <EventCard key={i} event={e} />)}
          </>}

          {events.length === 0 && <p style={{ color: '#aaa', fontSize: 14 }}>No upcoming assignments in the next 2 weeks.</p>}
        </>)}

        {added.map((e, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid #eee', borderLeft: '3px solid #185FA5', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>{e.title}</p>
              <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{e.sub}</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, background: '#E6F1FB', color: '#185FA5' }}>Added</span>
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

  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderLeft: `3px solid ${accentColor(days)}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>{event.title}</p>
        <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{dateStr} · Schoology</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle(days) }}>{badgeLabel(days)}</span>
    </div>
  )
}
