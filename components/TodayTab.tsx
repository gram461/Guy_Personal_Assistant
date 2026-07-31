'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Backpack, BookOpen, CalendarCheck, Dumbbell, GraduationCap, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadSettings, defaultChecklist } from '@/lib/settingsStorage'
import { daysUntil, filterTodaySummary } from '@/lib/summaryFilters'
import { GreetingHeader, type TimeOfDay } from '@/components/dashboard/greeting-header'
import { StatusSummary } from '@/components/dashboard/status-summary'
import { AlertCard } from '@/components/dashboard/alert-card'
import { ListCard } from '@/components/dashboard/list-card'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { Tag } from '@/components/dashboard/tag'

const CHECKLIST_ITEMS = [
  { key: 'studied', label: 'Studied today?', icon: BookOpen },
  { key: 'workedOut', label: 'Worked out today?', icon: Dumbbell },
  { key: 'packed', label: 'Bag packed for tomorrow?', icon: Backpack },
] as const

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  if (hour >= 7 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'night'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatEventTime(dateStr: string) {
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return 'All day'
}

function timePrefix(dateStr: string) {
  return dateStr.includes('T') ? `${formatEventTime(dateStr)} · ` : ''
}

function daysTag(days: number) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

export default function TodayTab() {
  const [time, setTime] = useState<TimeOfDay>(getTimeOfDay())
  const [events, setEvents] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [emails, setEmails] = useState<any[]>([])
  const [checklist, setChecklist] = useState({ studied: null as boolean | null, workedOut: null as boolean | null, packed: null as boolean | null })
  const [enabledChecklist, setEnabledChecklist] = useState(defaultChecklist)
  const [morningSummary, setMorningSummary] = useState<string | null>(null)
  const checklistItems = CHECKLIST_ITEMS.filter(item => enabledChecklist[item.key])

  useEffect(() => {
    fetch('/api/calendar').then(r => r.json()).then(d => setEvents(d.events || []))
    fetch('/api/schoology').then(r => r.json()).then(d => setAssignments(d.events || []))
    fetch('/api/gmail').then(r => r.json()).then(d => setEmails((d.emails || []).filter((e: any) => e.unread)))
    loadSettings().then(({ nightlyChecklist }) => setEnabledChecklist(nightlyChecklist))
  }, [])

  useEffect(() => {
    if (time !== 'morning') return
    fetch('/api/morning-summary')
      .then(r => r.json())
      .then(d => setMorningSummary(d.summary || null))
      .catch(() => {})
  }, [time])

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeOfDay()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const toggle = (key: keyof typeof checklist, val: boolean) =>
    setChecklist(prev => ({ ...prev, [key]: prev[key] === val ? null : val }))

  const { todayEvents, upcomingEvents, upcomingAssignments, urgentItems } = filterTodaySummary(events, assignments)
  const morningParagraphs = morningSummary ? morningSummary.split('\n\n') : ['Getting your day ready...']

  return (
    <div>
      <GreetingHeader name="Guy" timeOfDay={time} dateLabel={formatDate()} />

      <div className="space-y-3.5 p-4">
        <StatusSummary
          timeOfDay={time}
          assignments={upcomingAssignments.length}
          events={todayEvents.length}
          paragraphs={morningParagraphs}
        />

        {/* Urgent alerts */}
        {urgentItems.map((item, i) => (
          <AlertCard
            key={i}
            icon={AlertTriangle}
            tone="urgent"
            title={item.title}
            subtitle={daysUntil(item.date) === 0 ? 'Due today' : 'Due tomorrow'}
            tag={daysUntil(item.date) === 0 ? 'Today' : 'Tomorrow'}
          />
        ))}

        {/* Unread emails alert */}
        {emails.length > 0 && time !== 'night' && (
          <AlertCard
            icon={Mail}
            tone="warning"
            title={`${emails.length} unread email${emails.length !== 1 ? 's' : ''}`}
            subtitle={emails[0]?.subject || ''}
            tag={`${emails.length} new`}
          />
        )}

        {/* Today's events */}
        {time !== 'night' && todayEvents.length > 0 && (
          <section aria-labelledby="today-heading">
            <SectionHeading title="Today" />
            <div id="today-heading" className="space-y-2.5">
              {todayEvents.map((e, i) => (
                <ListCard
                  key={i}
                  icon={CalendarCheck}
                  iconTone="brand"
                  title={e.title}
                  subtitle={`${formatEventTime(e.date)} · Google Calendar`}
                  right={<Tag tone="brand">Today</Tag>}
                />
              ))}
            </div>
          </section>
        )}

        {/* Coming up */}
        {time !== 'night' && (upcomingEvents.length > 0 || upcomingAssignments.length > 0) && (
          <section aria-labelledby="coming-heading">
            <SectionHeading title="Coming up" />
            <div id="coming-heading" className="space-y-2.5">
              {upcomingAssignments.map((a, i) => {
                const days = daysUntil(a.date)
                const tone = days <= 2 ? 'urgent' : 'warning'
                return (
                  <ListCard
                    key={i}
                    icon={GraduationCap}
                    iconTone={tone}
                    accentEdge={tone}
                    title={a.title}
                    subtitle={`${timePrefix(a.date)}Schoology · ${days === 1 ? 'tomorrow' : `${days} days`}`}
                    right={<Tag tone={tone}>{daysTag(days)}</Tag>}
                  />
                )
              })}
              {upcomingEvents.map((e, i) => {
                const days = daysUntil(e.date)
                return (
                  <ListCard
                    key={i}
                    icon={CalendarCheck}
                    iconTone="brand"
                    accentEdge="brand"
                    title={e.title}
                    subtitle={`${timePrefix(e.date)}Google Calendar · ${days === 1 ? 'tomorrow' : `${days} days`}`}
                    right={<Tag tone="brand">{daysTag(days)}</Tag>}
                  />
                )
              })}
            </div>
          </section>
        )}

        {time !== 'night' && todayEvents.length === 0 && upcomingEvents.length === 0 && upcomingAssignments.length === 0 && (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">Nothing coming up this week.</p>
        )}

        {/* Night checklist */}
        {time === 'night' && checklistItems.length > 0 && (
          <section aria-labelledby="checklist-heading">
            <SectionHeading title="Nightly checklist" />
            <div id="checklist-heading" className="overflow-hidden rounded-2xl bg-card">
              {checklistItems.map((item, i) => (
                <div key={item.key}>
                  {i > 0 ? <div className="h-px bg-border/60" /> : null}
                  <ChecklistRow
                    label={item.label}
                    icon={item.icon}
                    val={checklist[item.key]}
                    onYes={() => toggle(item.key, true)}
                    onNo={() => toggle(item.key, false)}
                  />
                </div>
              ))}
            </div>

            {upcomingAssignments.length > 0 && (
              <div className="mt-7">
                <SectionHeading title="Due soon" />
                <div className="space-y-2.5">
                  {upcomingAssignments.map((a, i) => {
                    const days = daysUntil(a.date)
                    const tone = days <= 1 ? 'urgent' : 'warning'
                    return (
                      <ListCard
                        key={i}
                        icon={GraduationCap}
                        iconTone={tone}
                        accentEdge={tone}
                        title={a.title}
                        subtitle={`${timePrefix(a.date)}Schoology · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`}`}
                        right={<Tag tone={tone}>{days === 0 ? 'Today' : daysTag(days)}</Tag>}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function ChecklistRow({
  label,
  icon: Icon,
  val,
  onYes,
  onNo,
}: {
  label: string
  icon: typeof BookOpen
  val: boolean | null
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/80">
          <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden="true" />
        </div>
        <p className="truncate text-sm font-semibold text-card-foreground">{label}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onYes}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
            val === true ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground hover:text-foreground',
          )}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={onNo}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
            val === false ? 'bg-urgent-muted text-urgent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground',
          )}
        >
          No
        </button>
      </div>
    </div>
  )
}
