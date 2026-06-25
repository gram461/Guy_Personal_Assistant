'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import AddEventModal from './AddEventModal'

type Event = { title: string; date: string; location: string }

function daysUntil(dateStr: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const then = new Date(dateStr)
  then.setHours(0, 0, 0, 0)
  return Math.ceil((then.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function badgeLabel(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function badgeStyle(days: number): React.CSSProperties {
  if (days <= 1) return { background: '#E1F5EE', color: '#0F6E56' }
  if (days <= 3) return { background: '#FAEEDA', color: '#854F0B' }
  return { background: '#E6F1FB', color: '#185FA5' }
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#aaa',
  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px'
}

export default function PersonalTab() {
  const { data: session } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
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

  return (
    <div>
      <div style={{ background: '#1a3a2e', padding: '20px 20px 16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Personal</p>
          <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Your events & family calendar</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      <div style={{ padding: 16 }}>
        {!session ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>Connect Google Calendar to see your events</p>
            <button onClick={() => signIn('google')} style={{ background: '#1a3a2e', color: 'white', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            {loading && <p style={{ color: '#aaa', fontSize: 14 }}>Loading your calendar...</p>}

            {!loading && today.length > 0 && <>
              <p style={sectionLabel}>Today</p>
              {today.map((e, i) => <EventCard key={i} event={e} />)}
            </>}

            {!loading && week.length > 0 && <>
              <p style={sectionLabel}>This week</p>
              {week.map((e, i) => <EventCard key={i} event={e} />)}
            </>}

            {!loading && events.length === 0 && (
              <p style={{ color: '#aaa', fontSize: 14 }}>No upcoming events in the next 2 weeks.</p>
            )}

            {added.map((e, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #eee', borderLeft: '3px solid #0F6E56', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>{e.title}</p>
                  <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{e.sub}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, background: '#E1F5EE', color: '#0F6E56' }}>Added</span>
              </div>
            ))}

            <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '13px', background: '#1a3a2e', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 }}>
              + Add personal event
            </button>

            <button onClick={() => signOut()} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#aaa', border: '1px solid #eee', borderRadius: 12, fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
              Sign out of Google
            </button>
          </>
        )}
      </div>

      {showModal && <AddEventModal type="personal" onClose={() => setShowModal(false)} onAdd={e => { setAdded(p => [...p, e]); setShowModal(false) }} />}
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const days = daysUntil(event.date)
  const date = new Date(event.date)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderLeft: '3px solid #0F6E56', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>{event.title}</p>
        <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{dateStr} · Google Calendar</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle(days) }}>{badgeLabel(days)}</span>
    </div>
  )
}
