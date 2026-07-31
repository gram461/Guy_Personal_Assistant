'use client'

import { CalendarCheck, GraduationCap, Inbox, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TabKey = 'today' | 'school' | 'personal' | 'inbox' | 'settings'

const tabs: { key: TabKey; label: string; icon: typeof CalendarCheck }[] = [
  { key: 'today', label: 'Today', icon: CalendarCheck },
  { key: 'school', label: 'School', icon: GraduationCap },
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'inbox', label: 'Inbox', icon: Inbox },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-10 border-t border-border bg-background/80 backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.key === active
          return (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[0.7rem] font-semibold leading-none">{tab.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
