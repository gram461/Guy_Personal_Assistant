'use client'

import { useState, useEffect } from 'react'

type TimeOfDay = 'morning' | 'afternoon' | 'night'

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'night'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatEventTime(dateStr: string) {
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return 'All day'
}

const greetings = {
  morning: 'Good morning, Guy',
  afternoon: 'Good afternoon, Guy',
  night: 'Good evening, Guy',
}

const headerBg = {
  morning: '#1a1a2e',
  afternoon: '#1a3a2e',
  night: '#0d0d1a',
}

export default function TodayTab() {
  const [time, setTime] = useState<TimeOfDay>(getTimeOfDay())
  const [events, setEvents] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [emails, setEmails] = useState<any[]>([])
  const [checklist, setChecklist] = useState({ studied: null as boolean | null, workedOut: null as boolean | null, packed: null as boolean | null })

  useEffect(() => {
    fetch('/api/calendar').then(r => r.json()).then(d => setEvents(d.events || []))
    fetch('/api/schoology').then(r => r.json()).then(d => setAssignments(d.events || []))
    fetch('/api/gmail').then(r => r.json()).then(d => setEmails((d.emails || []).filter((e: any) => e.unread)))
  }, [])

  const toggle = (key: keyof typeof checklist, val: boolean) =>
    setChecklist(prev => ({ ...prev, [key]: prev[key] === val ? null : val }))

  const todayEvents = events.filter(e => daysUntil(e.date) === 0)
  const upcomingEvents = events.filter(e => daysUntil(e.date) > 0 && daysUntil(e.date) <= 7)
  const upcomingAssignments = assignments.filter(a => daysUntil(a.date) >= 0 && daysUntil(a.date) <= 7)
  const urgentItems = [...upcomingAssignments, ...upcomingEvents].filter(i => daysUntil(i.date) <= 1)

  return (
    <div>
      <div style={{ background: headerBg[time], padding: '20px 20px 16px', color: 'white' }}>
        <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 2px' }}>{formatDate()}</p>
        <p style={{ fontSize: 20, fontWeight: 500, margin: '0 0 12px' }}>{greetings[time]}</p>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            {upcomingAssignments.length === 0 && todayEvents.length === 0
              ? 'No assignments or events coming up. Enjoy your day.'
              : `You have ${upcomingAssignments.length} assignment${upcomingAssignments.length !== 1 ? 's' : ''} and ${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} today.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['morning', 'afternoon', 'night'] as TimeOfDay[]).map(t => (
            <button key={t} onClick={() => setTime(t)} style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid',
              borderColor: time === t ? 'white' : 'rgba(255,255,255,0.3)',
              background: time === t ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: 'white', cursor: 'pointer'
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Urgent alerts */}
        {urgentItems.map((item, i) => (
          <div key={i} style={{ background: '#FCEBEB', border: '1px solid #F7C1C1', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#501313', margin: 0 }}>{item.title}</p>
              <p style={{ fontSize: 12, color: '#A32D2D', margin: '2px 0 0' }}>
                {daysUntil(item.date) === 0 ? 'Due today' : 'Due tomorrow'}
              </p>
            </div>
          </div>
        ))}

        {/* Unread emails alert */}
        {emails.length > 0 && time !== 'night' && (
          <div style={{ background: '#FAEEDA', border: '1px solid #F0D28A', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✉️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#5a3a00', margin: 0 }}>{emails.length} unread email{emails.length !== 1 ? 's' : ''}</p>
              <p style={{ fontSize: 12, color: '#854F0B', margin: '2px 0 0' }}>{emails[0]?.subject}</p>
            </div>
          </div>
        )}

        {/* Today's events */}
        {time !== 'night' && todayEvents.length > 0 && (<>
          <p style={sectionLabel}>Today</p>
          {todayEvents.map((e, i) => (
            <EventCard key={i} title={e.title} sub={`${formatEventTime(e.date)} · Google Calendar`} badge="Today" badgeStyle={blueBadge} />
          ))}
        </>)}

        {/* Coming up */}
        {time !== 'night' && (upcomingEvents.length > 0 || upcomingAssignments.length > 0) && (<>
          <p style={sectionLabel}>Coming up</p>
          {upcomingAssignments.map((a, i) => {
            const days = daysUntil(a.date)
            return <EventCard key={i} title={a.title} sub={`Schoology · ${days === 1 ? 'tomorrow' : `${days} days`}`} badge={days === 1 ? 'Tomorrow' : `${days} days`} badgeStyle={days <= 2 ? redBadge : amberBadge} accent={days <= 2 ? '#E24B4A' : '#BA7517'} />
          })}
          {upcomingEvents.map((e, i) => {
            const days = daysUntil(e.date)
            return <EventCard key={i} title={e.title} sub={`Google Calendar · ${days === 1 ? 'tomorrow' : `${days} days`}`} badge={days === 1 ? 'Tomorrow' : `${days} days`} badgeStyle={blueBadge} accent="#185FA5" />
          })}
        </>)}

        {time !== 'night' && todayEvents.length === 0 && upcomingEvents.length === 0 && upcomingAssignments.length === 0 && (
          <p style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 32 }}>Nothing coming up this week.</p>
        )}

        {/* Night checklist */}
        {time === 'night' && (<>
          <p style={sectionLabel}>Nightly checklist</p>
          <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <ChecklistRow label="Studied today?" icon="📖" val={checklist.studied} onYes={() => toggle('studied', true)} onNo={() => toggle('studied', false)} />
            <ChecklistRow label="Worked out today?" icon="🏃" val={checklist.workedOut} onYes={() => toggle('workedOut', true)} onNo={() => toggle('workedOut', false)} />
            <ChecklistRow label="Bag packed for tomorrow?" icon="🎒" val={checklist.packed} onYes={() => toggle('packed', true)} onNo={() => toggle('packed', false)} last />
          </div>

          {upcomingAssignments.length > 0 && (<>
            <p style={sectionLabel}>Due soon</p>
            {upcomingAssignments.map((a, i) => {
              const days = daysUntil(a.date)
              return <EventCard key={i} title={a.title} sub={`Schoology · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`}`} badge={days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`} badgeStyle={days <= 1 ? redBadge : amberBadge} accent={days <= 1 ? '#E24B4A' : '#BA7517'} />
            })}
          </>)}
        </>)}
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }
const redBadge: React.CSSProperties = { background: '#FCEBEB', color: '#A32D2D' }
const amberBadge: React.CSSProperties = { background: '#FAEEDA', color: '#854F0B' }
const blueBadge: React.CSSProperties = { background: '#E6F1FB', color: '#185FA5' }

function EventCard({ title, sub, badge, badgeStyle, accent }: { title: string; sub: string; badge: string; badgeStyle: React.CSSProperties; accent?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderLeft: accent ? `3px solid ${accent}` : '1px solid #eee', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{sub}</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle }}>{badge}</span>
    </div>
  )
}

function ChecklistRow({ label, icon, val, onYes, onNo, last }: { label: string; icon: string; val: boolean | null; onYes: () => void; onNo: () => void; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: last ? 'none' : '1px solid #eee' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>
        <p style={{ fontSize: 14, color: '#222', margin: 0 }}>{label}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onYes} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1px solid', borderColor: val === true ? '#86efac' : '#e5e5e5', background: val === true ? '#dcfce7' : 'transparent', color: val === true ? '#15803d' : '#999', cursor: 'pointer' }}>Yes</button>
        <button onClick={onNo} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1px solid', borderColor: val === false ? '#fca5a5' : '#e5e5e5', background: val === false ? '#fee2e2' : 'transparent', color: val === false ? '#b91c1c' : '#999', cursor: 'pointer' }}>No</button>
      </div>
    </div>
  )
}
