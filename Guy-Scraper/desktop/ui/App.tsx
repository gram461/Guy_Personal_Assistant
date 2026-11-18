import { useState } from 'react'
import { Email } from './Email'
import { Personal } from './Personal'
import { Icon, Notice, SignInBanner, type IconName } from './parts'
import { School } from './School'
import { Settings } from './Settings'
import { Today } from './Today'
import { useSynergy } from './useSynergy'

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'personal', label: 'Personal', icon: 'personal' },
  { id: 'school', label: 'School', icon: 'school' },
  { id: 'email', label: 'Email', icon: 'email' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

export function App() {
  const app = useSynergy()
  const [tab, setTab] = useState('today')
  const unreadCount = app.mail.messages?.filter(m => m.unread).length ?? 0

  return (
    <div className="app">
      <main className="screen" key={tab}>
        {app.problem && <Notice tone="problem" text={app.problem} onDismiss={app.dismiss} />}
        {app.notice && <Notice text={app.notice} onDismiss={app.dismiss} />}
        {app.loaded && tab !== 'settings' && !app.data.status?.signedIn && <SignInBanner busy={app.syncing} onSignIn={() => void app.signIn()} />}
        {!app.loaded ? (
          <div className="loading">Opening your grades…</div>
        ) : tab === 'today' ? (
          <Today app={app} />
        ) : tab === 'school' ? (
          <School app={app} />
        ) : tab === 'settings' ? (
          <Settings app={app} />
        ) : tab === 'personal' ? (
          <Personal app={app} />
        ) : (
          <Email app={app} />
        )}
      </main>
      <nav aria-label="Main" className="tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="tab-icon">
              <Icon name={t.icon} />
              {t.id === 'email' && unreadCount > 0 && <span className="badge" aria-label={`${unreadCount} unread`}>{unreadCount}</span>}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
