export type NotificationSettings = { morning: boolean; afternoon: boolean; night: boolean }
export type NightlyChecklistSettings = { studied: boolean; workedOut: boolean; packed: boolean }
export type UserSettings = {
  notifications: NotificationSettings
  nightlyChecklist: NightlyChecklistSettings
  displayName: string
}

export const defaultNotifications: NotificationSettings = { morning: true, afternoon: true, night: true }
export const defaultChecklist: NightlyChecklistSettings = { studied: true, workedOut: true, packed: true }
export const defaultSettings: UserSettings = {
  notifications: defaultNotifications,
  nightlyChecklist: defaultChecklist,
  displayName: '',
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const res = await fetch('/api/settings')
    if (!res.ok) return defaultSettings
    return await res.json()
  } catch {
    return defaultSettings
  }
}

async function saveSettings(patch: Partial<UserSettings>) {
  await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}

export async function saveNotificationSettings(value: NotificationSettings) {
  await saveSettings({ notifications: value })
}

export async function saveNightlyChecklistSettings(value: NightlyChecklistSettings) {
  await saveSettings({ nightlyChecklist: value })
}

export async function saveDisplayName(value: string) {
  await saveSettings({ displayName: value })
}
