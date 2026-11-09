import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GradebookClass } from '../../gradebook'
import { MAX_TITLE_LENGTH } from '../../savedEdits'
import { shortDate, syncedLabel, timeLabel } from './dates'
import {
  addAssignment, checkNewAssignment, classTitle, percentText, pointsText, removeAssignment, resetClass, setPointsText, setScoreText, teacherName, viewClass,
  type ClassView, type Row,
} from './grades'
import { Empty, Header, Icon, SyncButton } from './parts'
import type { Bessy } from './useBessy'

const barWidth = (percent: number | null) => `${percent === null ? 0 : Math.max(0, Math.min(100, percent)).toFixed(2)}%`

// An input that keeps what is being typed and hands it over when the user is done with it.
function NumberField({ value, onCommit, label, placeholder, className }: { value: string; onCommit: (text: string) => void; label: string; placeholder: string; className: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      maxLength={20}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}

function dueText(row: Row): string {
  if (row.kind === 'added') return 'Added by you'
  if (!row.dueDate) return 'No due date'
  return row.dueTime ? `${shortDate(row.dueDate)}, ${timeLabel(row.dueTime)}` : shortDate(row.dueDate)
}

function ScoreCell({ row, readOnly, onScore, onPoints, onRemove }: { row: Row; readOnly: boolean; onScore: (text: string) => void; onPoints: (text: string) => void; onRemove: () => void }) {
  if (readOnly && (row.kind === 'normal' || row.kind === 'added')) {
    const shown = row.score.state === 'ok' ? `${row.scoreText} / ${row.pointsText || '-'}` : row.waiting ? 'Waiting for a grade' : 'Not graded'
    return <span className="static-score">{shown}</span>
  }
  if (row.kind === 'excused') return <span className="chip gray">Excused</span>
  if (row.kind === 'missing') return <span className="chip red">Missing</span>
  if (row.kind === 'written') return <span className="chip blue">{row.gradeText}</span>

  const scoreBad = row.score.state === 'bad'
  const pointsBad = row.points.state === 'bad'
  const needsPoints = row.pointsEditable && row.score.state === 'ok' && row.points.state !== 'ok'
  const percent = row.score.state === 'ok' && row.points.state === 'ok' && row.points.value > 0 ? `${Math.round((row.score.value / row.points.value) * 100)}%` : ''

  let note: ReactNode = percent
  if (scoreBad) note = <span className="error">Enter a number</span>
  else if (pointsBad) note = <span className="error">Points must be a number</span>
  else if (needsPoints) note = <span className="error">Enter the points</span>
  else if (row.score.state === 'empty') {
    note = row.waiting ? (
      <>
        <span className="square" />
        Waiting for a grade
      </>
    ) : (
      'Not graded'
    )
  }

  return (
    <>
      <div className="score-cell">
        <div className="score-line">
          <NumberField className="score-input" value={row.scoreText} onCommit={onScore} label={`Score for ${row.title}`} placeholder="-" />
          <span className="slash">/</span>
          {row.pointsEditable ? (
            <NumberField className="points-input" value={row.pointsText} onCommit={onPoints} label={`Points possible for ${row.title}`} placeholder="pts" />
          ) : (
            <span className="points">{pointsText(row.points.state === 'ok' ? row.points.value : 0)}</span>
          )}
        </div>
        <div className="score-note">{note}</div>
      </div>
      {row.kind === 'added' && (
        <button type="button" className="icon-button plain" aria-label={`Remove ${row.title}`} onClick={onRemove}>
          <Icon name="close" size={18} />
        </button>
      )}
    </>
  )
}

function AddAssignment({ view, app }: { view: ClassView; app: Bessy }) {
  const cls = view.cls
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [points, setPoints] = useState('')
  const [category, setCategory] = useState(view.categoryOptions[0].value)
  const [tried, setTried] = useState(false)

  const check = checkNewAssignment(cls, app.data.edits, { name, points, category })
  const submit = () => {
    if (!check.ok) {
      setTried(true)
      return
    }
    app.changeEdits(edits => addAssignment(cls, edits, check.added))
    setOpen(false)
    setName('')
    setPoints('')
    setTried(false)
  }

  return (
    <>
      <button type="button" className="add-toggle" aria-expanded={open} onClick={() => { setOpen(!open); setTried(false) }}>
        <span>Add an assignment</span>
        <span className="round">
          <span className={`turn${open ? ' open' : ''}`}><Icon name="chevronRight" size={20} stroke={2.4} /></span>
        </span>
      </button>
      {open && (
        <form className="add-form" onSubmit={e => { e.preventDefault(); submit() }}>
          <label className="field">
            <span>Name</span>
            <input type="text" placeholder="Unit 4 test" value={name} maxLength={MAX_TITLE_LENGTH + 20} onChange={e => setName(e.target.value)} />
            {tried && !check.ok && check.nameTooLong && <span className="error">Names can be up to {MAX_TITLE_LENGTH} characters.</span>}
          </label>
          <div className="two">
            <label className="field">
              <span>Points</span>
              <input type="text" inputMode="decimal" placeholder="50" value={points} maxLength={20} onChange={e => setPoints(e.target.value)} />
              {tried && !check.ok && check.pointsBad && <span className="error">Enter the points, more than 0.</span>}
            </label>
            <label className="field wide">
              <span>Category</span>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {view.categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          {tried && !check.ok && check.full && <span className="error">You can add up to 50 assignments to a class.</span>}
          <button type="submit" className="primary">Add assignment</button>
        </form>
      )}
    </>
  )
}

function ClassDetail({ view, app, onBack }: { view: ClassView; app: Bessy; onBack: () => void }) {
  const { cls, original, current } = view
  const letter = cls.gradeLetter
  const rows = useMemo(() => {
    const byDue = (a: Row, b: Row) => (b.dueDate ?? '').localeCompare(a.dueDate ?? '')
    const added = view.rows.filter(r => r.kind === 'added')
    return [...added, ...view.rows.filter(r => r.kind !== 'added').sort(byDue)]
  }, [view.rows])

  const lettersOnly = !view.recalculable
  const schoologyText = lettersOnly
    ? "Schoology gives this class a letter grade without a percentage, so scores can't be recalculated here."
    : view.edited
    ? `Schoology shows ${percentText(original.percent)}${letter ? ` (${letter})` : ''}`
    : letter ? `Schoology shows ${letter}` : 'From your last sync'

  return (
    <>
      <div className="back-row">
        <button type="button" className="back" onClick={onBack}>
          <Icon name="chevronLeft" size={22} stroke={2.2} />
          School
        </button>
      </div>
      <Header eyebrow={`${teacherName(cls.teacher)} · ${cls.term}`} title={classTitle(cls.name)} />

      <section className="card grade-card" aria-label="Your grade">
        <div>
          <div className="kicker plain">Your grade</div>
          <div className="big">{lettersOnly ? (cls.gradeLetter ?? '-') : percentText(current.percent)}</div>
          <div className="sub">{schoologyText}</div>
        </div>
        {view.edited && view.recalculable && (
          <button type="button" className="secondary" onClick={() => app.changeEdits(edits => resetClass(cls, edits))}>
            Reset
          </button>
        )}
      </section>

      {view.recalculable && current.method === 'weighted' && (
        <section className="card" aria-labelledby="cats-h">
          <h2 id="cats-h">Categories</h2>
          {current.categories.map((c, i) => {
            const was = original.categories[i]?.percent ?? null
            const changed = was !== null && c.percent !== null && Math.abs(was - c.percent) >= 0.005
            return (
              <div className="category" key={c.name}>
                <div className="row-between">
                  <span className="strong">{c.name} <span className="weight">· {c.weight}%</span></span>
                  <span className="bold">{c.percent === null ? 'No grades yet' : percentText(c.percent)}</span>
                </div>
                <div className="bar thin"><div style={{ width: barWidth(c.percent) }} /></div>
                <div className="row-between sub">
                  <span>
                    {c.fixed ? "Percentage from Schoology (no scores listed)" : c.possible > 0 ? `${pointsText(c.earned)} of ${pointsText(c.possible)} points${c.adjusted ? ' (includes missing work)' : ''}` : 'Nothing graded yet'}
                  </span>
                  {changed && <span className="was">was {percentText(was)}</span>}
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section className="card" aria-labelledby="all-h">
        {view.recalculable && <AddAssignment view={view} app={app} />}
        <div className={`all-head${view.recalculable ? '' : ' first'}`}>
          <h2 id="all-h">All grades</h2>
          <span className="sub">{rows.length} {rows.length === 1 ? 'assignment' : 'assignments'}</span>
        </div>
        {view.recalculable && <div className="hint">Tap the number before the slash to enter or change a score. Where Schoology doesn't show the points, you can fill those in too.</div>}
        {rows.map(row => (
          <div className="line" key={row.scoreKey}>
            <div className="grow">
              <div className="strong">{row.title}</div>
              <div className="sub">
                {row.category ?? 'No category'} · {dueText(row)}
                {row.edited && <span className="edited"> · Edited</span>}
              </div>
            </div>
            <ScoreCell
              row={row}
              readOnly={!view.recalculable}
              onScore={text => app.changeEdits(edits => setScoreText(edits, row, text))}
              onPoints={text => app.changeEdits(edits => setPointsText(edits, row, text))}
              onRemove={() => app.changeEdits(edits => removeAssignment(cls, edits, row.addedId as number))}
            />
          </div>
        ))}
      </section>
    </>
  )
}

function statusLine(view: ClassView): string {
  if (view.rows.length === 0) return 'No assignments yet'
  const open = view.rows.filter(r => r.kind === 'normal' && r.score.state === 'empty' && !r.waiting).length
  const waiting = view.rows.filter(r => r.waiting && r.score.state === 'empty').length
  if (open === 0 && waiting === 0) return 'All graded'
  return waiting > 0 ? `${open} open · ${waiting} waiting for a grade` : `${open} open`
}

export function School({ app }: { app: Bessy }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const { gradebook, edits, status } = app.data
  const now = new Date()

  // Every class Schoology lists, including ones with no work yet.
  const classes: GradebookClass[] = gradebook?.classes ?? []
  const views = classes.map(c => viewClass(c, edits))
  const terms = new Set(classes.map(c => c.term))

  const selected = views.find(v => v.cls.key === openKey)
  if (selected) return <ClassDetail view={selected} app={app} onBack={() => setOpenKey(null)} />

  return (
    <>
      <Header
        eyebrow={terms.size === 1 ? `Term ${[...terms][0]} · ${syncedLabel(status?.lastSyncedAt ?? null, now)}` : syncedLabel(status?.lastSyncedAt ?? null, now)}
        title="School"
        action={<SyncButton syncing={app.syncing} onSync={() => void app.sync()} />}
      />
      {views.length === 0 ? (
        <Empty title="No classes yet">
          <p>Sync with Schoology to see your classes and grades.</p>
          <button type="button" className="primary" disabled={app.syncing} onClick={() => void app.sync()}>
            {app.syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </Empty>
      ) : (
        <>
          <div className="lead">Tap a class to see all of its grades.</div>
          {views.map(view => (
            <button type="button" className="class-card" key={view.cls.key} aria-label={`Open ${view.cls.name} grades`} onClick={() => setOpenKey(view.cls.key)}>
              <span className="row-between top">
                <span className="min0">
                  <span className="name">{classTitle(view.cls.name)}</span>
                  <span className="sub block">{teacherName(view.cls.teacher)}{terms.size > 1 ? ` · ${view.cls.term}` : ''}</span>
                </span>
                <span className="right">
                  <span className="min-width">
                    <span className="pct">{view.recalculable ? percentText(view.current.percent) : (view.cls.gradeLetter ?? '-')}</span>
                    <span className="letter">{view.edited || !view.recalculable ? '' : (view.cls.gradeLetter ?? '')}</span>
                  </span>
                  <Icon name="chevronRight" size={20} stroke={2.2} />
                </span>
              </span>
              <span className="bar"><span style={{ width: barWidth(view.recalculable ? view.current.percent : null) }} /></span>
              <span className="sub block status">{statusLine(view)}</span>
            </button>
          ))}
        </>
      )}
    </>
  )
}
