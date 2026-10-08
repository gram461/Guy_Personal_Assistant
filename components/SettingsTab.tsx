'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Calendar, GraduationCap, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  loadSettings,
  saveNotificationSettings,
  saveNightlyChecklistSettings,
  saveDisplayName,
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
  const [displayName, setDisplayName] = useState('')
  const [pushState, setPushState] = useState<PushState>('default')
  const [pushBusy, setPushBusy] = useState(false)
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting' | 'error'>('idle')

  useEffect(() => {
    loadSettings().then(({ notifications, nightlyChecklist, displayName }) => {
      setNotifs(notifications)
      setChecklist(nightlyChecklist)
      setDisplayName(displayName)
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

  const deleteMyData = async () => {
    setDeleteState('deleting')
    const res = await fetch('/api/account-data', { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setDeleteState('error')
      return
    }
    await signOut({ callbackUrl: '/' })
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
            {(displayName || session?.user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => saveDisplayName(displayName.trim())}
              placeholder={session?.user?.name?.split(' ')[0] || 'Your name'}
              className="w-full truncate bg-transparent text-base font-bold text-card-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
            <p className="truncate text-sm text-muted-foreground">{session?.user?.email || 'Not signed in'}</p>
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
            <AccountRow icon={GraduationCap} label="Schoology" connected={false} />
            <div className="h-px bg-border/60" />
            <AccountRow icon={Mail} label="Gmail" connected={!!session} />
            <div className="h-px bg-border/60" />
            <AccountRow icon={Calendar} label="Google Calendar" connected={!!session} />
          </div>
        </section>

        {/* Your data */}
        {session && (
          <section aria-labelledby="settings-data">
            <SectionHeading title="Your data" />
            <div id="settings-data" className="rounded-2xl bg-card p-4">
              <p className="text-sm font-semibold text-card-foreground">Delete my data</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                Removes your settings, completed assignments, notification devices, and saved Google access, then signs you out.
              </p>

              {deleteState === 'confirm' || deleteState === 'deleting' ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={deleteMyData}
                    disabled={deleteState === 'deleting'}
                    className="rounded-xl bg-urgent px-4 py-2 text-xs font-bold text-urgent-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    {deleteState === 'deleting' ? 'Deleting...' : 'Yes, delete everything'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteState('idle')}
                    disabled={deleteState === 'deleting'}
                    className="rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteState('confirm')}
                  className="mt-3 rounded-xl bg-urgent-muted px-4 py-2 text-xs font-bold text-urgent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  Delete my data
                </button>
              )}

              {deleteState === 'error' && (
                <p className="mt-2 text-xs font-medium text-urgent">Couldn&apos;t delete your data. Please try again.</p>
              )}
            </div>
          </section>
        )}
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
