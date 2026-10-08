import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/session'
import { loadSettingsForUser, saveSettingsForUser } from '@/lib/settingsServer'
import type { NightlyChecklistSettings, NotificationSettings, UserSettings } from '@/lib/settingsStorage'

const MAX_DISPLAY_NAME_LENGTH = 50

function pickBooleans<K extends string>(value: unknown, keys: readonly K[]): Record<K, boolean> | null {
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  if (!keys.every(k => typeof source[k] === 'boolean')) return null
  return Object.fromEntries(keys.map(k => [k, source[k]])) as Record<K, boolean>
}

function parsePatch(body: unknown): Partial<UserSettings> | null {
  if (typeof body !== 'object' || body === null) return null
  const input = body as Record<string, unknown>
  const patch: Partial<UserSettings> = {}

  if ('notifications' in input) {
    const value = pickBooleans(input.notifications, ['morning', 'afternoon', 'night'] as const)
    if (!value) return null
    patch.notifications = value satisfies NotificationSettings
  }
  if ('nightlyChecklist' in input) {
    const value = pickBooleans(input.nightlyChecklist, ['studied', 'workedOut', 'packed'] as const)
    if (!value) return null
    patch.nightlyChecklist = value satisfies NightlyChecklistSettings
  }
  if ('displayName' in input) {
    if (typeof input.displayName !== 'string') return null
    const name = input.displayName.trim()
    if (name.length > MAX_DISPLAY_NAME_LENGTH) return null
    patch.displayName = name
  }

  return Object.keys(patch).length > 0 ? patch : null
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  return NextResponse.json(await loadSettingsForUser(userId))
}

export async function PATCH(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const patch = parsePatch(await req.json().catch(() => null))
  if (!patch) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })

  try {
    await saveSettingsForUser(userId, patch)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
