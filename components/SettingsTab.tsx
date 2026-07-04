'use client'

import { useState } from 'react'
import { colors, headerColors, sectionLabelStyle } from '@/lib/theme'

export default function SettingsTab() {
  const [notifs, setNotifs] = useState({ morning: true, afternoon: true, night: true })
  const [checklist, setChecklist] = useState({ studied: true, workedOut: true, packed: true })

  return (
    <div>
      <div style={{ background: headerColors.navy, padding: '20px 20px 16px', color: 'white' }}>
        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Settings</p>
        <p style={{ fontSize: 13, opacity: 0.6, margin: '4px 0 0' }}>Customize your assistant</p>
      </div>

      <div style={{ padding: 16 }}>
        {/* Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8f8f8', borderRadius: 12, padding: '14px', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: headerColors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 600, flexShrink: 0 }}>G</div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>Guy</p>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: '2px 0 0' }}>Cupertino High School</p>
          </div>
        </div>

        {/* Notifications */}
        <p style={sectionLabelStyle}>Notifications</p>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <ToggleRow label="Morning summary" sub="7:00 am" checked={notifs.morning} onChange={() => setNotifs(p => ({ ...p, morning: !p.morning }))} />
          <ToggleRow label="Afternoon check-in" sub="3:30 pm" checked={notifs.afternoon} onChange={() => setNotifs(p => ({ ...p, afternoon: !p.afternoon }))} />
          <ToggleRow label="Night reminder" sub="9:00 pm" checked={notifs.night} onChange={() => setNotifs(p => ({ ...p, night: !p.night }))} last />
        </div>

        {/* Nightly checklist */}
        <p style={sectionLabelStyle}>Nightly checklist</p>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <ToggleRow label="Ask if I studied" checked={checklist.studied} onChange={() => setChecklist(p => ({ ...p, studied: !p.studied }))} />
          <ToggleRow label="Ask if I worked out" checked={checklist.workedOut} onChange={() => setChecklist(p => ({ ...p, workedOut: !p.workedOut }))} />
          <ToggleRow label="Ask if bag is packed" checked={checklist.packed} onChange={() => setChecklist(p => ({ ...p, packed: !p.packed }))} last />
        </div>

        {/* Connected accounts */}
        <p style={sectionLabelStyle}>Connected accounts</p>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <AccountRow icon="🎓" label="Schoology" />
          <AccountRow icon="✉️" label="Gmail" />
          <AccountRow icon="📅" label="Google Calendar" last />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, sub, checked, onChange, last }: { label: string; sub?: string; checked: boolean; onChange: () => void; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${colors.border}` }}>
      <div>
        <p style={{ fontSize: 14, color: colors.textPrimary, margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 12, color: colors.textSecondary, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      <button onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: checked ? headerColors.navy : '#ddd', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
      </button>
    </div>
  )
}

function AccountRow({ icon, label, last }: { icon: string; label: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ fontSize: 14, color: colors.textPrimary, margin: 0 }}>{label}</p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Connected</span>
    </div>
  )
}
