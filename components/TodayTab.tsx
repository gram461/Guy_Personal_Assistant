'use client'

import { useState, useEffect } from 'react'
import { colors, headerColors, badge as badgeColors, sectionLabelStyle, cardStyle } from '@/lib/theme'
import { loadSettings, defaultChecklist } from '@/lib/settingsStorage'

const CHECKLIST_ITEMS = [
  { key: 'studied', label: 'Studied today?', icon: '📖' },
  { key: 'workedOut', label: 'Worked out today?', icon: '🏃' },
  { key: 'packed', label: 'Bag packed for tomorrow?', icon: '🎒' },
] as const

type TimeOfDay = 'morning' | 'afternoon' | 'night'

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour >= 7 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
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

function timePrefix(dateStr: string) {
  return dateStr.includes('T') ? `${formatEventTime(dateStr)} · ` : ''
}

const greetings = {
  morning: 'Good morning, Guy',
  afternoon: 'Good afternoon, Guy',
  night: 'Good evening, Guy',
}

const headerBg = {
  morning: headerColors.navy,
  afternoon: headerColors.green,
  night: headerColors.night,
}

export default function TodayTab() {
  const [time, setTime] = useState<TimeOfDay>(getTimeOfDay())
  const [events, setEvents] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [emails, setEmails] = useState<any[]>([])
  const [checklist, setChecklist] = useState({ studied: null as boolean | null, workedOut: null as boolean | null, packed: null as boolean | null })
  const [enabledChecklist, setEnabledChecklist] = useState(defaultChecklist)
  const checklistItems = CHECKLIST_ITEMS.filter(item => enabledChecklist[item.key])

  useEffect(() => {
    fetch('/api/calendar').then(r => r.json()).then(d => setEvents(d.events || []))
    fetch('/api/schoology').then(r => r.json()).then(d => setAssignments(d.events || []))
    fetch('/api/gmail').then(r => r.json()).then(d => setEmails((d.emails || []).filter((e: any) => e.unread)))
    loadSettings().then(({ nightlyChecklist }) => setEnabledChecklist(nightlyChecklist))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeOfDay()), 60 * 1000)
    return () => clearInterval(id)
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
      </div>

      <div style={{ padding: '16px' }}>
        {/* Urgent alerts */}
        {urgentItems.map((item, i) => (
          <div key={i} style={{ background: badgeColors.red.background, border: '1px solid #F7C1C1', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#501313', margin: 0 }}>{item.title}</p>
              <p style={{ fontSize: 12, color: badgeColors.red.color, margin: '2px 0 0' }}>
                {daysUntil(item.date) === 0 ? 'Due today' : 'Due tomorrow'}
              </p>
            </div>
          </div>
        ))}

        {/* Unread emails alert */}
        {emails.length > 0 && time !== 'night' && (
          <div style={{ background: badgeColors.amber.background, border: '1px solid #F0D28A', borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✉️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#5a3a00', margin: 0 }}>{emails.length} unread email{emails.length !== 1 ? 's' : ''}</p>
              <p style={{ fontSize: 12, color: badgeColors.amber.color, margin: '2px 0 0' }}>{emails[0]?.subject}</p>
            </div>
          </div>
        )}

        {/* Today's events */}
        {time !== 'night' && todayEvents.length > 0 && (<>
          <p style={sectionLabelStyle}>Today</p>
          {todayEvents.map((e, i) => (
            <EventCard key={i} title={e.title} sub={`${formatEventTime(e.date)} · Google Calendar`} badge="Today" badgeStyle={badgeColors.blue} />
          ))}
        </>)}

        {/* Coming up */}
        {time !== 'night' && (upcomingEvents.length > 0 || upcomingAssignments.length > 0) && (<>
          <p style={sectionLabelStyle}>Coming up</p>
          {upcomingAssignments.map((a, i) => {
            const days = daysUntil(a.date)
            return <EventCard key={i} title={a.title} sub={`${timePrefix(a.date)}Schoology · ${days === 1 ? 'tomorrow' : `${days} days`}`} badge={days === 1 ? 'Tomorrow' : `${days} days`} badgeStyle={days <= 2 ? badgeColors.red : badgeColors.amber} accent={days <= 2 ? badgeColors.red.accent : badgeColors.amber.accent} />
          })}
          {upcomingEvents.map((e, i) => {
            const days = daysUntil(e.date)
            return <EventCard key={i} title={e.title} sub={`${timePrefix(e.date)}Google Calendar · ${days === 1 ? 'tomorrow' : `${days} days`}`} badge={days === 1 ? 'Tomorrow' : `${days} days`} badgeStyle={badgeColors.blue} accent={badgeColors.blue.accent} />
          })}
        </>)}

        {time !== 'night' && todayEvents.length === 0 && upcomingEvents.length === 0 && upcomingAssignments.length === 0 && (
          <p style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 32 }}>Nothing coming up this week.</p>
        )}

        {/* Night checklist */}
        {time === 'night' && checklistItems.length > 0 && (<>
          <p style={sectionLabelStyle}>Nightly checklist</p>
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            {checklistItems.map((item, i) => (
              <ChecklistRow
                key={item.key}
                label={item.label}
                icon={item.icon}
                val={checklist[item.key]}
                onYes={() => toggle(item.key, true)}
                onNo={() => toggle(item.key, false)}
                last={i === checklistItems.length - 1}
              />
            ))}
          </div>

          {upcomingAssignments.length > 0 && (<>
            <p style={sectionLabelStyle}>Due soon</p>
            {upcomingAssignments.map((a, i) => {
              const days = daysUntil(a.date)
              return <EventCard key={i} title={a.title} sub={`${timePrefix(a.date)}Schoology · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`}`} badge={days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`} badgeStyle={days <= 1 ? badgeColors.red : badgeColors.amber} accent={days <= 1 ? badgeColors.red.accent : badgeColors.amber.accent} />
            })}
          </>)}
        </>)}
      </div>
    </div>
  )
}

function EventCard({ title, sub, badge, badgeStyle, accent }: { title: string; sub: string; badge: string; badgeStyle: React.CSSProperties; accent?: string }) {
  return (
    <div style={{ ...cardStyle, borderLeft: accent ? `3px solid ${accent}` : `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ fontSize: 12, color: colors.textSecondary, margin: '3px 0 0' }}>{sub}</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle }}>{badge}</span>
    </div>
  )
}

function ChecklistRow({ label, icon, val, onYes, onNo, last }: { label: string; icon: string; val: boolean | null; onYes: () => void; onNo: () => void; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: last ? 'none' : `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>
        <p style={{ fontSize: 14, color: '#222', margin: 0 }}>{label}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onYes} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1px solid', borderColor: val === true ? '#86efac' : '#e5e5e5', background: val === true ? '#dcfce7' : 'transparent', color: val === true ? '#15803d' : colors.textSecondary, cursor: 'pointer' }}>Yes</button>
        <button onClick={onNo} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, border: '1px solid', borderColor: val === false ? '#fca5a5' : '#e5e5e5', background: val === false ? '#fee2e2' : 'transparent', color: val === false ? '#b91c1c' : colors.textSecondary, cursor: 'pointer' }}>No</button>
      </div>
    </div>
  )
}
