import { supabase } from './supabaseClient'

export type NotificationSettings = { morning: boolean; afternoon: boolean; night: boolean }
export type NightlyChecklistSettings = { studied: boolean; workedOut: boolean; packed: boolean }

export const defaultNotifications: NotificationSettings = { morning: true, afternoon: true, night: true }
export const defaultChecklist: NightlyChecklistSettings = { studied: true, workedOut: true, packed: true }

export async function loadSettings(): Promise<{
  notifications: NotificationSettings
  nightlyChecklist: NightlyChecklistSettings
}> {
  const { data, error } = await supabase
    .from('settings')
    .select('notifications, nightly_checklist')
    .eq('id', 'default')
    .single()

  if (error || !data) {
    return { notifications: defaultNotifications, nightlyChecklist: defaultChecklist }
  }

  return {
    notifications: data.notifications ?? defaultNotifications,
    nightlyChecklist: data.nightly_checklist ?? defaultChecklist,
  }
}

export async function saveNotificationSettings(value: NotificationSettings) {
  await supabase.from('settings').update({ notifications: value }).eq('id', 'default')
}

export async function saveNightlyChecklistSettings(value: NightlyChecklistSettings) {
  await supabase.from('settings').update({ nightly_checklist: value }).eq('id', 'default')
}
