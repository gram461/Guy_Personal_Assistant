import type { DashboardAssignment } from '../../dashboard'
import { dateKey, dayNumber, daysBetween, greeting, shortDate, syncedLabel, timeLabel, todayLong, weekdayShort } from './dates'
import { classTitle } from './grades'
import { Empty, Header, SyncButton } from './parts'
import { useDisplayName, useDoneAssignments } from './prefs'
import type { Synergy } from './useSynergy'

const COMING_UP_LIMIT = 6

const dueTime = (a: DashboardAssignment) => {
  if (a.allDay) return 'All day'
  const parts = new Date(a.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Los_Angeles' })
  return timeLabel(parts)
}

const list = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

// A plain-English summary written from the data on this computer. Nothing is sent anywhere to write it.
export function summarize(due: DashboardAssignment[], upcoming: DashboardAssignment[], missing: DashboardAssignment[], today: string): string[] {
  const lines: string[] = []
  if (due.length === 0) lines.push('Nothing is due today.')
  else {
    const shown = due.slice(0, 3).map(a => `${a.title} (${classTitle(a.className)})`)
    const more = due.length > 3 ? `, plus ${due.length - 3} more` : ''
    lines.push(`You have ${due.length} ${due.length === 1 ? 'assignment' : 'assignments'} due today: ${list(shown)}${more}.`)
  }

  const next = upcoming[0]
  if (next) {
    const days = daysBetween(today, next.dueDate)
    lines.push(`Next up: ${next.title} in ${classTitle(next.className)}, due ${days === 1 ? 'tomorrow' : shortDate(next.dueDate)}.`)
  }

  if (missing.length > 0) lines.push(`${missing.length} ${missing.length === 1 ? 'assignment is' : 'assignments are'} marked missing in Schoology.`)
  return lines
}

export function Today({ app }: { app: Synergy }) {
  const [name] = useDisplayName()
  const [done, toggleDone] = useDoneAssignments()
  const now = new Date()
  const today = dateKey(now)
  const { dashboard, gradebook, edits, status } = app.data

  const hasData = (gradebook?.classes.length ?? 0) > 0
  // Work the user typed a score for is finished as far as this screen is concerned.
  const scored = new Set(Object.entries(edits.scores).filter(([, text]) => text.trim() !== '').map(([id]) => id))
  const open = (dashboard?.assignments ?? []).filter(a => !scored.has(a.uid))

  const missing = open.filter(a => a.status === 'missing')
  const upcomingAll = open.filter(a => a.status !== 'missing' && a.dueDate > today)
  const dueToday = open.filter(a => a.status !== 'missing' && a.dueDate === today)
  const dueTodayLeft = dueToday.filter(a => !done.has(a.uid))
  const comingUp = upcomingAll.filter(a => !done.has(a.uid)).slice(0, COMING_UP_LIMIT)

  const title = name.trim() ? `${greeting(now)}, ${name.trim()}` : greeting(now)

  return (
    <>
      <Header eyebrow={todayLong(now)} title={title} note={syncedLabel(status?.lastSyncedAt ?? null, now)} action={<SyncButton syncing={app.syncing} onSync={() => void app.sync()} />} />

      {!hasData ? (
        <Empty title="No grades yet">
          <p>Sign in to Schoology to bring your assignments and grades here. Your password is never saved, and everything is kept in an encrypted file on this computer.</p>
          <button type="button" className="primary" disabled={app.syncing} onClick={() => void app.sync()}>
            {app.syncing ? 'Syncing…' : 'Connect to Schoology'}
          </button>
        </Empty>
      ) : (
        <>
          <section className="card" aria-labelledby="summary-h">
            <h2 id="summary-h" className="kicker">Your summary</h2>
            {summarize(dueTodayLeft, comingUp, missing, today).map(line => (
              <p key={line} className="summary">{line}</p>
            ))}
          </section>

          {missing.length > 0 && (
            <section className="card" aria-labelledby="missing-h">
              <div className="card-title">
                <h2 id="missing-h">Missing</h2>
                <span className="count warn">{missing.length}</span>
              </div>
              {missing.map(a => (
                <div className="line" key={a.uid}>
                  <div className="grow">
                    <div className="strong">{a.title}</div>
                    <div className="sub">{classTitle(a.className)} · was due {shortDate(a.dueDate)}</div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="card" aria-labelledby="due-h">
            <div className="card-title">
              <h2 id="due-h">Due today</h2>
              <span className="count">{dueTodayLeft.length}</span>
            </div>
            {dueToday.length === 0 && <div className="sub pad">Nothing due today.</div>}
            {dueToday.map(a => {
              const checked = done.has(a.uid)
              return (
                <div className="line" key={a.uid}>
                  <button type="button" className="check" role="checkbox" aria-checked={checked} aria-label={`Mark ${a.title} done`} onClick={() => toggleDone(a.uid)}>
                    <span className={checked ? 'on' : ''}>{checked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}</span>
                  </button>
                  <div className={`grow${checked ? ' struck' : ''}`}>
                    <div className="strong">{a.title}</div>
                    <div className="sub">{classTitle(a.className)} · {dueTime(a)}</div>
                  </div>
                </div>
              )
            })}
          </section>

          <section className="card" aria-labelledby="soon-h">
            <h2 id="soon-h">Coming up</h2>
            {comingUp.length === 0 && <div className="sub pad">Nothing else due in the next 30 days.</div>}
            {comingUp.map(a => (
              <div className="line day" key={a.uid}>
                <div className="date">
                  <div className="dow">{weekdayShort(a.dueDate)}</div>
                  <div className="dom">{dayNumber(a.dueDate)}</div>
                </div>
                <div className="grow">
                  <div className="strong">{a.title}</div>
                  <div className="sub">{classTitle(a.className)} · {dueTime(a)}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  )
}
