import { useMemo, useState } from 'react'
import { synergy, type MailMessage } from './bridge'
import { GoogleConnect } from './GoogleConnect'
import { Header, Icon, SyncButton } from './parts'
import { canFilterBySchool, fullTime, gmailLink, initials, isFromSchool, listTime } from './mail'
import type { Synergy } from './useSynergy'

type Filter = 'all' | 'unread' | 'school'

function Detail({ message, email, onBack }: { message: MailMessage; email: string | null; onBack: () => void }) {
  const now = new Date()
  return (
    <>
      <div className="back-row">
        <button type="button" className="back" onClick={onBack}>
          <Icon name="chevronLeft" size={22} stroke={2.2} />
          Email
        </button>
      </div>
      <h1 className="message-subject">{message.subject}</h1>
      <div className="sender-row">
        <div className="avatar small" aria-hidden="true">{initials(message.fromName)}</div>
        <div className="grow">
          <div className="strong">{message.fromName}</div>
          {message.fromAddress && <div className="sub break">{message.fromAddress}</div>}
          <div className="sub">{fullTime(message.receivedAt, now)}</div>
        </div>
      </div>
      <p className="preview-text">{message.snippet || 'No preview is available for this message.'}</p>
      <div className="hint">This is the short preview Gmail provides. Synergy doesn't read the rest of your email. Open the message in Gmail to read all of it.</div>
      <button type="button" className="primary wide" onClick={() => void synergy().openExternal(gmailLink(email, message.threadId))}>Open in Gmail</button>
    </>
  )
}

function Inbox({ app }: { app: Synergy }) {
  const email = app.data.google?.email ?? null
  const { messages, loading, error } = app.mail
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const now = new Date()

  const all = messages ?? []
  const unread = all.filter(m => m.unread)
  const schoolFilter = canFilterBySchool(email)
  const shown = useMemo(
    () => (filter === 'unread' ? all.filter(m => m.unread) : filter === 'school' ? all.filter(m => isFromSchool(m, email)) : all),
    [all, filter, email],
  )

  const open = all.find(m => m.id === openId)
  if (open) return <Detail message={open} email={email} onBack={() => setOpenId(null)} />

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: unread.length > 0 ? `Unread · ${unread.length}` : 'Unread' },
    ...(schoolFilter ? [{ id: 'school' as Filter, label: 'From school' }] : []),
  ]

  return (
    <>
      <Header eyebrow={`Gmail${email ? ` · ${email}` : ''}`} title="Email" action={<SyncButton syncing={loading} onSync={() => void app.refreshMail()} label="Refresh email" />} />

      <div className="chips" role="group" aria-label="Filter messages">
        {chips.map(c => (
          <button key={c.id} type="button" className={`chip-button${filter === c.id ? ' on' : ''}`} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <section className="card list" aria-label="Messages">
        {error && <div className="error pad">{error}</div>}
        {messages === null && !error && <div className="sub pad">Loading your email…</div>}
        {messages !== null && shown.length === 0 && <div className="empty-line">No messages here.</div>}
        {shown.map(m => (
          <button
            type="button"
            className="message"
            key={m.id}
            aria-label={`${m.fromName}, ${m.subject}${m.unread ? ', unread' : ''}`}
            onClick={() => setOpenId(m.id)}
          >
            <span className={`dot${m.unread ? ' on' : ''}`} />
            <span className="message-body">
              <span className="row-between">
                <span className={`sender${m.unread ? ' unread' : ''}`}>{m.fromName}</span>
                <span className="when">{listTime(m.receivedAt, now)}</span>
              </span>
              <span className={`subject${m.unread ? ' unread' : ''}`}>{m.subject}</span>
              <span className="snippet">{m.snippet}</span>
            </span>
            <Icon name="chevronRight" size={18} stroke={2.2} />
          </button>
        ))}
      </section>

      <div className="note-card">Synergy can only read your inbox. To reply, archive, or attach files, open a message in Gmail.</div>
    </>
  )
}

export function Email({ app }: { app: Synergy }) {
  const connected = app.data.google?.connected ?? false
  if (!connected) return <GoogleConnect app={app} eyebrow="Your inbox" title="Email" what="your Gmail inbox" />
  if (app.mail.needsReconnect) return <GoogleConnect app={app} eyebrow="Your inbox" title="Email" what="your Gmail inbox" again />
  return <Inbox app={app} />
}
