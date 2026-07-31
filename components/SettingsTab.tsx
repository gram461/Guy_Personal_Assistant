'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Calendar, GraduationCap, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { ScreenHeader } from '@/components/dashboard/screen-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { Toggle } from '@/components/dashboard/toggle'
import { Tag } from '@/components/dashboard/tag'

type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

const pushCopy: Record<PushState, string> = {
  granted: 'Enabled',
  default: 'Not enabled yet',
  denied: 'Blocked in browser settings',
  unsupported: 'Not supported on this browser',
}

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
      <ScreenHeader title="Settings" subtitle="Customize your assistant" />

      <div className="space-y-7 p-4">
        {/* Profile */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-card p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-muted text-lg font-extrabold text-primary-foreground">
            G
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-card-foreground">Guy</p>
            <p className="truncate text-sm text-muted-foreground">Cupertino High School</p>
          </div>
        </div>

        {/* Notifications */}
        <section aria-labelledby="settings-notifications">
          <SectionHeading title="Notifications" />
          <div id="settings-notifications" className="overflow-hidden rounded-2xl bg-card">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-card-foreground">Push notifications on this device</p>
                <p
                  className={cn(
                    'mt-0.5 text-xs font-medium',
                    pushState === 'granted' && 'text-success',
                    pushState === 'default' && 'text-muted-foreground',
                    pushState === 'denied' && 'text-urgent',
                    pushState === 'unsupported' && 'text-muted-foreground',
                  )}
                >
                  {pushCopy[pushState]}
                </p>
              </div>
              {pushState !== 'granted' && pushState !== 'unsupported' && (
                <button
                  type="button"
                  onClick={enablePush}
                  disabled={pushBusy || pushState === 'denied'}
                  className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {pushBusy ? 'Enabling...' : 'Enable'}
                </button>
              )}
            </div>

            <div className="h-px bg-border/60" />

            <ToggleRow label="Morning summary" sub="7:00 am" checked={notifs.morning} onChange={() => toggleNotif('morning')} />
            <div className="h-px bg-border/60" />
            <ToggleRow label="Afternoon check-in" sub="3:30 pm" checked={notifs.afternoon} onChange={() => toggleNotif('afternoon')} />
            <div className="h-px bg-border/60" />
            <ToggleRow label="Night reminder" sub="9:00 pm" checked={notifs.night} onChange={() => toggleNotif('night')} />
          </div>
        </section>

        {/* Nightly checklist */}
        <section aria-labelledby="settings-checklist">
          <SectionHeading title="Nightly checklist" />
          <div id="settings-checklist" className="overflow-hidden rounded-2xl bg-card">
            <ToggleRow label="Ask if I studied" checked={checklist.studied} onChange={() => toggleChecklist('studied')} />
            <div className="h-px bg-border/60" />
            <ToggleRow label="Ask if I worked out" checked={checklist.workedOut} onChange={() => toggleChecklist('workedOut')} />
            <div className="h-px bg-border/60" />
            <ToggleRow label="Ask if bag is packed" checked={checklist.packed} onChange={() => toggleChecklist('packed')} />
          </div>
        </section>

        {/* Connected accounts */}
        <section aria-labelledby="settings-accounts">
          <SectionHeading title="Connected accounts" />
          <div id="settings-accounts" className="overflow-hidden rounded-2xl bg-card">
            <AccountRow icon={GraduationCap} label="Schoology" connected />
            <div className="h-px bg-border/60" />
            <AccountRow icon={Mail} label="Gmail" connected={!!session} />
            <div className="h-px bg-border/60" />
            <AccountRow icon={Calendar} label="Google Calendar" connected={!!session} />
          </div>
        </section>
      </div>
    </div>
  )
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sub}</p>}
      </div>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  )
}

function AccountRow({ icon: Icon, label, connected }: { icon: typeof GraduationCap; label: string; connected: boolean }) {
  return (
    <div className="flex items-center gap-3.5 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/80">
        <Icon className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </div>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">{label}</p>
      <Tag tone={connected ? 'success' : 'urgent'}>{connected ? 'Connected' : 'Not connected'}</Tag>
    </div>
  )
}
