'use client'

import { useState } from 'react'
import AddEventModal from './AddEventModal'

const fixed = [
  { title: 'Math test', sub: 'Tomorrow · Schoology', badge: 'Tomorrow', badgeStyle: { background: '#FCEBEB', color: '#A32D2D' }, accent: '#E24B4A', section: 'soon' },
  { title: 'Study group with Jake', sub: 'Today · 4:00 pm · Added by you', badge: 'Today', badgeStyle: { background: '#E6F1FB', color: '#185FA5' }, accent: '#185FA5', section: 'soon' },
  { title: 'History essay', sub: 'Friday · Schoology', badge: '3 days', badgeStyle: { background: '#FAEEDA', color: '#854F0B' }, accent: '#BA7517', section: 'week' },
  { title: 'Bio reading — Ch. 7', sub: 'Thursday · Schoology', badge: '2 days', badgeStyle: { background: '#E6F1FB', color: '#185FA5' }, accent: '#185FA5', section: 'week' },
  { title: 'English vocab quiz', sub: 'Next Monday · Schoology', badge: '6 days', badgeStyle: { background: '#F1EFE8', color: '#5F5E5A' }, accent: '#aaa', section: 'week' },
]

export default function SchoolTab() {
  const [showModal, setShowModal] = useState(false)
  const [added, setAdded] = useState<{ title: string; sub: string }[]>([])

  return (
    <div>
      <div style={{ background: '#1a1a2e', padding: '20px 20px 16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>School</p>
          <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Assignments, tests & events</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      <div style={{ padding: 16 }}>
        <p style={sectionLabel}>Today & tomorrow</p>
        {fixed.filter(e => e.section === 'soon').map((e, i) => <EventCard key={i} {...e} />)}

        <p style={sectionLabel}>This week</p>
        {fixed.filter(e => e.section === 'week').map((e, i) => <EventCard key={i} {...e} />)}
        {added.map((e, i) => <EventCard key={i} title={e.title} sub={e.sub} badge="Added" badgeStyle={{ background: '#E6F1FB', color: '#185FA5' }} accent="#185FA5" />)}
      </div>

      {showModal && <AddEventModal type="school" onClose={() => setShowModal(false)} onAdd={e => { setAdded(p => [...p, e]); setShowModal(false) }} />}
    </div>
  )
}

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }

function EventCard({ title, sub, badge, badgeStyle, accent }: { title: string; sub: string; badge: string; badgeStyle: React.CSSProperties; accent: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#999', margin: '3px 0 0' }}>{sub}</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, whiteSpace: 'nowrap', ...badgeStyle }}>{badge}</span>
    </div>
  )
}
