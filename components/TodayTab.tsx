'use client'

import { useState } from 'react'

type TimeOfDay = 'morning' | 'afternoon' | 'night'

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'night'
}

const summaries = {
  morning: 'You have a math test tomorrow and a history essay due Friday. Light day today — one soccer practice at 5pm.',
  afternoon: "Math test is tomorrow — you haven't studied yet. History essay is due Friday. Get math done first tonight.",
  night: 'Math test is tomorrow morning. Before you sleep — make sure you\'ve studied and you\'re packed.',
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
  const [checklist, setChecklist] = useState({ studied: null as boolean | null, workedOut: null as boolean | null, packed: null as boolean | null })

  const toggle = (key: keyof typeof checklist, val: boolean) =>
    setChecklist(prev => ({ ...prev, [key]: prev[key] === val ? null : val }))

  return (
    <div>
      {/* Header */}
      <div style={{ background: headerBg[time], padding: '20px 20px 16px', color: 'white' }}>
        <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 2px' }}>Tuesday, June 24</p>
        <p style={{ fontSize: 20, fontWeight: 500, margin: '0 0 12px' }}>{greetings[time]}</p>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{summaries[time]}</p>
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
        {/* Night urgent alert */}
        {time === 'night' && (
          <div style={{ background: '#FCEBEB', border: '1px solid #F7C1C1', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#501313', margin: 0 }}>Math test — tomorrow</p>
              <p style={{ fontSize: 12, color: '#A32D2D', margin: '2px 0 0' }}>Have you studied?</p>
            </div>
          </div>
        )}

        {/* Today + Coming up */}
        {time !== 'night' && (<>
          <p style={sectionLabel}>Today</p>
          <EventCard title="Soccer practice" sub="5:00 pm · Google Calendar" badge="Today" badgeStyle={blueBadge} />
          <EventCard title="Email from Mr. Johnson" sub="Re: extra credit opportunity" badge="Unread" badgeStyle={amberBadge} />

          <p style={sectionLabel}>Coming up</p>
          <EventCard title="Math test" sub="Schoology · tomorrow" badge="Tomorrow" badgeStyle={redBadge} accent="#E24B4A" />
          <EventCard title="History essay" sub="Schoology · Friday" badge="3 days" badgeStyle={amberBadge} accent="#BA7517" />
          <EventCard title="Family dinner at grandma's" sub="Google Calendar · Sunday" badge="5 days" badgeStyle={blueBadge} accent="#185FA5" />
        </>)}

        {/* Afternoon: Do tonight */}
        {time === 'afternoon' && (<>
          <p style={sectionLabel}>Do tonight</p>
          <CheckItem label="Study for math test" sub="Due tomorrow" subColor="#A32D2D" accent="#E24B4A" />
          <CheckItem label="Work on history essay" sub="Due Friday · 3 days" subColor="#854F0B" accent="#BA7517" />
          <CheckItem label="Bio reading — Ch. 7" sub="Due Thursday · 2 days" subColor="#888" accent="#185FA5" />
        </>)}

        {/* Night checklist */}
        {time === 'night' && (<>
          <p style={sectionLabel}>Nightly checklist</p>
          <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <ChecklistRow label="Studied for math test?" icon="📖" val={checklist.studied} onYes={() => toggle('studied', true)} onNo={() => toggle('studied', false)} />
            <ChecklistRow label="Worked out today?" icon="🏃" val={checklist.workedOut} onYes={() => toggle('workedOut', true)} onNo={() => toggle('workedOut', false)} last={false} />
            <ChecklistRow label="Bag packed for tomorrow?" icon="🎒" val={checklist.packed} onYes={() => toggle('packed', true)} onNo={() => toggle('packed', false)} last />
          </div>

          <p style={sectionLabel}>Tomorrow</p>
          <div style={{ background: '#f8f8f8', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
              <p style={{ fontSize: 13, color: '#888', margin: 0 }}>8:00 am</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#A32D2D', margin: 0 }}>Math test</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
              <p style={{ fontSize: 13, color: '#888', margin: 0 }}>3:00 pm</p>
              <p style={{ fontSize: 13, color: '#333', margin: 0 }}>School ends</p>
            </div>
          </div>
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
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{sub}</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle }}>{badge}</span>
    </div>
  )
}

function CheckItem({ label, sub, subColor, accent }: { label: string; sub: string; subColor: string; accent: string }) {
  const [checked, setChecked] = useState(false)
  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={() => setChecked(!checked)} style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${checked ? '#22c55e' : '#ddd'}`, background: checked ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
        {checked && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
      </button>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: checked ? '#bbb' : '#111', textDecoration: checked ? 'line-through' : 'none', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, color: subColor, margin: '3px 0 0' }}>{sub}</p>
      </div>
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
