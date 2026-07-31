import { Sparkles, Sun } from 'lucide-react'
import type { TimeOfDay } from './greeting-header'

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function StatusSummary({
  timeOfDay,
  assignments,
  events,
  paragraphs,
}: {
  timeOfDay: TimeOfDay
  assignments: number
  events: number
  /** morning-only: one or two short paragraphs of AI-written prose */
  paragraphs: string[]
}) {
  if (timeOfDay === 'morning') {
    return (
      <section
        aria-label="Your morning briefing"
        className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/25"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Sun className="size-[18px]" strokeWidth={2.25} aria-hidden="true" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
            Your morning briefing
          </span>
        </div>
        <div className="mt-4 space-y-3.5">
          {paragraphs.map((text, i) => (
            <p key={i} className="text-pretty text-sm leading-relaxed text-primary-foreground/95">
              {text}
            </p>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg shadow-primary/25">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
        <Sparkles className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold leading-snug text-balance">
        You have {plural(assignments, 'assignment')} and {plural(events, 'event')} today
      </p>
    </div>
  )
}
