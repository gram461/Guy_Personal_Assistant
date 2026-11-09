import { useState } from 'react'
import { NotHere } from './NotHere'
import { Icon, Notice, type IconName } from './parts'
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

  return (
    <div className="app">
      <main className="screen" key={tab}>
        {app.problem && <Notice tone="problem" text={app.problem} onDismiss={app.dismiss} />}
        {app.notice && <Notice text={app.notice} onDismiss={app.dismiss} />}
        {!app.loaded ? (
          <div className="loading">Opening your grades…</div>
        ) : tab === 'today' ? (
          <Today app={app} />
        ) : tab === 'school' ? (
          <School app={app} />
        ) : tab === 'settings' ? (
          <Settings app={app} />
        ) : tab === 'personal' ? (
          <NotHere eyebrow="Your own plans" title="Personal" what="Your personal calendar and to-dos live in the web version of Synergy." />
        ) : (
          <NotHere eyebrow="Your inbox" title="Email" what="Email lives in the web version of Synergy." />
        )}
      </main>
      <nav aria-label="Main" className="tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
