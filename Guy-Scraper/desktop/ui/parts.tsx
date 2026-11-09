import type { ReactNode } from 'react'

const PATHS = {
  sync: 'M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  today: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  personal: 'M4 21c0-4 4-7 8-7s8 3 8 7',
  school: 'M2 9l10-5 10 5-10 5-10-5z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
  email: 'M3 7l9 6 9-6',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
      {name === 'today' && <circle cx="12" cy="12" r="4" />}
      {name === 'personal' && <circle cx="12" cy="8" r="4" />}
      {name === 'email' && <rect x="3" y="5" width="18" height="14" rx="2" />}
      {name === 'settings' && (
        <>
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </>
      )}
    </svg>
  )
}

export function Header({ eyebrow, title, note, action }: { eyebrow: string; title: string; note?: string; action?: ReactNode }) {
  return (
    <header className="header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {note && <div className="note">{note}</div>}
      </div>
      {action}
    </header>
  )
}

export function SyncButton({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  return (
    <button type="button" className={`icon-button${syncing ? ' spinning' : ''}`} aria-label={syncing ? 'Syncing with Schoology' : 'Sync from Schoology'} disabled={syncing} onClick={onSync}>
      <Icon name="sync" size={20} />
    </button>
  )
}

export function Notice({ text, onDismiss, tone = 'info' }: { text: string; onDismiss: () => void; tone?: 'info' | 'problem' }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'problem' ? 'alert' : 'status'}>
      <span>{text}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card empty">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
