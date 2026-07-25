'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { colors, headerColors, sectionLabelStyle } from '@/lib/theme'
import {
  loadSettings,
  saveNotificationSettings,
  saveNightlyChecklistSettings,
  defaultNotifications,
  defaultChecklist,
  type NotificationSettings,
  type NightlyChecklistSettings,
} from '@/lib/settingsStorage'
import { requestPushToken } from '@/lib/firebaseClient'
import { savePushToken } from '@/lib/pushTokens'

type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

export default function SettingsTab() {
  const { data: session } = useSession()
  const [notifs, setNotifs] = useState(defaultNotifications)
  const [checklist, setChecklist] = useState(defaultChecklist)
  const [pushState, setPushState] = useState<PushState>('default')
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    loadSettings().then(({ notifications, nightlyChecklist }) => {
      setNotifs(notifications)
      setChecklist(nightlyChecklist)
    })
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushState(Notification.permission)
    } else {
      setPushState('unsupported')
    }
  }, [])

  const enablePush = async () => {
    setPushBusy(true)
    const token = await requestPushToken()
    if (token) await savePushToken(token)
    setPushState(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
    setPushBusy(false)
  }

  const toggleNotif = (key: keyof NotificationSettings) => {
    setNotifs(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveNotificationSettings(next)
      return next
    })
  }

  const toggleChecklist = (key: keyof NightlyChecklistSettings) => {
    setChecklist(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveNightlyChecklistSettings(next)
      return next
    })
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${colors.border}` }}>
            <div>
              <p style={{ fontSize: 14, color: colors.textPrimary, margin: 0 }}>Push notifications on this device</p>
              <p style={{ fontSize: 12, color: colors.textSecondary, margin: '2px 0 0' }}>
                {pushState === 'granted' ? 'Enabled' : pushState === 'denied' ? 'Blocked in browser settings' : pushState === 'unsupported' ? 'Not supported on this browser' : 'Not enabled yet'}
              </p>
            </div>
            {pushState !== 'granted' && pushState !== 'unsupported' && (
              <button
                onClick={enablePush}
                disabled={pushBusy || pushState === 'denied'}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: headerColors.navy, color: 'white', cursor: pushState === 'denied' ? 'default' : 'pointer', opacity: pushState === 'denied' ? 0.5 : 1 }}
              >
                {pushBusy ? 'Enabling...' : 'Enable'}
              </button>
            )}
          </div>
          <ToggleRow label="Morning summary" sub="7:00 am" checked={notifs.morning} onChange={() => toggleNotif('morning')} />
          <ToggleRow label="Afternoon check-in" sub="3:30 pm" checked={notifs.afternoon} onChange={() => toggleNotif('afternoon')} />
          <ToggleRow label="Night reminder" sub="9:00 pm" checked={notifs.night} onChange={() => toggleNotif('night')} last />
        </div>

        {/* Nightly checklist */}
        <p style={sectionLabelStyle}>Nightly checklist</p>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <ToggleRow label="Ask if I studied" checked={checklist.studied} onChange={() => toggleChecklist('studied')} />
          <ToggleRow label="Ask if I worked out" checked={checklist.workedOut} onChange={() => toggleChecklist('workedOut')} />
          <ToggleRow label="Ask if bag is packed" checked={checklist.packed} onChange={() => toggleChecklist('packed')} last />
        </div>

        {/* Connected accounts */}
        <p style={sectionLabelStyle}>Connected accounts</p>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <AccountRow icon="🎓" label="Schoology" connected />
          <AccountRow icon="✉️" label="Gmail" connected={!!session} />
          <AccountRow icon="📅" label="Google Calendar" connected={!!session} last />
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

function AccountRow({ icon, label, connected, last }: { icon: string; label: string; connected: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ fontSize: 14, color: colors.textPrimary, margin: 0 }}>{label}</p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: connected ? '#15803d' : '#A32D2D' }}>{connected ? 'Connected' : 'Not connected'}</span>
    </div>
  )
}
