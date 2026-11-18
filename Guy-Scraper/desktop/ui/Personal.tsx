import { useEffect, useMemo, useState } from 'react'
import { synergy, failureText, type CalendarEvent } from './bridge'
import { agendaTitle, buildWeek, weekLabel, weekRange, WEEKDAY_HEADERS } from './calendar'
import { GoogleConnect } from './GoogleConnect'
import { Header, Icon } from './parts'
import type { Synergy } from './useSynergy'

type Loaded = { offset: number; events: CalendarEvent[] | null; error: string | null; reconnect: boolean }

function Week({ app }: { app: Synergy }) {
  const now = useMemo(() => new Date(), [])
  const [offset, setOffset] = useState(0)
  const [loaded, setLoaded] = useState<Loaded>({ offset: 0, events: null, error: null, reconnect: false })

  const { from, to } = weekRange(offset, now)

  useEffect(() => {
    let cancelled = false
    void synergy().calendar(from.toISOString(), to.toISOString()).then(result => {
      if (cancelled) return
      if (result.ok) setLoaded({ offset, events: result.events, error: null, reconnect: false })
      else setLoaded({ offset, events: null, error: failureText(result, "Your calendar couldn't be loaded."), reconnect: !!result.reconnect })
    })
    return () => {
      cancelled = true
    }
    // The week is identified by its offset; `from` and `to` come from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])

  if (loaded.reconnect) return <GoogleConnect app={app} eyebrow="From your Google Calendar" title="Personal" what="Google Calendar" again />

  const ready = loaded.offset === offset && loaded.events !== null
  const { cells, groups } = buildWeek(ready ? (loaded.events as CalendarEvent[]) : [], from, now)

  return (
    <>
      <Header eyebrow="From your Google Calendar" title="Personal" />

      <section className="card week" aria-labelledby="week-h">
        <div className="week-head">
          <h2 id="week-h">{weekLabel(from)}</h2>
          <div className="week-arrows">
            <button type="button" className="icon-button small" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
              <Icon name="chevronLeft" size={18} stroke={2.2} />
            </button>
            <button type="button" className="icon-button small" aria-label="Next week" onClick={() => setOffset(offset + 1)}>
              <Icon name="chevronRight" size={18} stroke={2.2} />
            </button>
          </div>
        </div>
        <div className="week-grid heads">
          {WEEKDAY_HEADERS.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="week-grid">
          {cells.map(c => (
            <div className="day" key={c.key}>
              {c.isToday ? <span className="today-dot">{c.num}</span> : <span>{c.num}</span>}
              {c.hasEvents && !c.isToday && <span className="has-events" />}
            </div>
          ))}
        </div>
        {offset !== 0 && (
          <div className="center">
            <button type="button" className="soft" onClick={() => setOffset(0)}>Back to this week</button>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="agenda-h">
        <h2 id="agenda-h">{agendaTitle(offset, from)}</h2>
        {loaded.error && <div className="error pad">{loaded.error}</div>}
        {!ready && !loaded.error && <div className="sub pad">Loading your calendar…</div>}
        {ready && groups.length === 0 && <div className="sub pad">Nothing on your calendar this week.</div>}
        {groups.map(g => (
          <div key={g.key}>
            <div className="group-head">
              <span className={`group-label${g.isToday ? ' today' : ''}`}>{g.label}</span> <span className="sub inline">· {g.sub}</span>
            </div>
            {g.events.map(e => (
              <div className="event" key={e.id}>
                <div className="bar-accent" />
                <div className="grow">
                  <div className="strong">{e.title}</div>
                  <div className="sub">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      <div className="stack-center">
        <button type="button" className="secondary wide" onClick={() => void synergy().openExternal('https://calendar.google.com/')}>Open Google Calendar</button>
        <div className="hint center-text">Read-only here. To add or change an event, open Google Calendar.</div>
      </div>
    </>
  )
}

export function Personal({ app }: { app: Synergy }) {
  const google = app.data.google
  if (!google?.connected) return <GoogleConnect app={app} eyebrow="From your Google Calendar" title="Personal" what="Google Calendar" />
  return <Week app={app} />
}
