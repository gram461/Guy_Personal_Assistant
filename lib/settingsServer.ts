import { supabaseServer } from './supabaseServer'
import { defaultSettings, type UserSettings } from './settingsStorage'

export async function loadSettingsForUser(userId: string): Promise<UserSettings> {
  const { data } = await supabaseServer
    .from('settings')
    .select('notifications, nightly_checklist, display_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return defaultSettings

  return {
    notifications: data.notifications ?? defaultSettings.notifications,
    nightlyChecklist: data.nightly_checklist ?? defaultSettings.nightlyChecklist,
    displayName: data.display_name ?? '',
  }
}

export async function saveSettingsForUser(userId: string, patch: Partial<UserSettings>) {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() }
  if (patch.notifications) row.notifications = patch.notifications
  if (patch.nightlyChecklist) row.nightly_checklist = patch.nightlyChecklist
  if (patch.displayName !== undefined) row.display_name = patch.displayName || null

  const { error } = await supabaseServer.from('settings').upsert(row)
  if (error) throw new Error(`Failed to save settings: ${error.message}`)
}
