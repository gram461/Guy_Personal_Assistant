import { fetchAssignments } from './assignments'
import { fetchCalendarEvents } from './googleCalendar'
import { classifyImportantAssignments } from './assignmentImportance'
import { filterTodaySummary, daysUntil } from './summaryFilters'
import { supabaseServer } from './supabaseServer'

function pacificDateKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function listOrNone(items: string[]) {
  return items.length > 0 ? items.join('; ') : 'none'
}

async function generateSummaryText(userId: string, name: string, accessToken: string | null): Promise<string> {
  const [assignments, events] = await Promise.all([
    fetchAssignments(userId),
    accessToken ? fetchCalendarEvents(accessToken) : Promise.resolve([]),
  ])

  const { todayEvents, upcomingEvents, upcomingAssignments } = filterTodaySummary(events, assignments)
  const todayAssignments = upcomingAssignments.filter(a => daysUntil(a.date) === 0)
  const weekAssignments = upcomingAssignments.filter(a => daysUntil(a.date) > 0)

  const important = await classifyImportantAssignments(upcomingAssignments)
  const flaggedTitles = new Set(important.map(i => i.title))
  const label = (title: string) => (flaggedTitles.has(title) ? `${title} (HIGH-STAKES)` : title)

  const prompt = `You are ${name ? `${name}'s` : "a student's"} personal assistant. Write a short, plain-spoken summary of their day - two short paragraphs, no markdown, no bullet points, no headers, second person ("you have..."). Be direct and factual, not encouraging or cheerful. Keep each paragraph to 1-3 sentences.

Today's calendar events:
${listOrNone(todayEvents.map(e => `${e.title} at ${e.date}`))}

Today's assignments due:
${listOrNone(todayAssignments.map(a => label(a.title)))}

This week's upcoming assignments and events (excluding today):
${listOrNone([
  ...weekAssignments.map(a => `${label(a.title)} - due in ${daysUntil(a.date)} day(s)`),
  ...upcomingEvents.map(e => `${e.title} - in ${daysUntil(e.date)} day(s)`),
])}

Write two paragraphs:

Paragraph 1 - Today: State what's happening today. Mention HIGH-STAKES items by name with a brief reason why they matter. Group routine items briefly (e.g. "two regular homework assignments"). If nothing is due or happening today, say exactly that in one short sentence - e.g. "You have nothing due today." Do not add commentary, encouragement, or filler like "relax" or "take it easy."

Paragraph 2 - This week: State what's coming up later this week, prioritizing HIGH-STAKES and soon-due items. If nothing else is coming up, say so in one short sentence and stop - no padding.

Do not repeat the date. Do not use phrases like "Here is your summary." Do not add encouragement, pep talk, or motivational language anywhere. Start directly with the content.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error('Failed to generate summary')
  const data = await res.json()
  const rawText = data.content?.[0]?.text?.trim() || ''
  return rawText.replace(/^```(?:\w+)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

export async function getMorningSummary(userId: string, name: string, accessToken: string | null): Promise<string> {
  const today = pacificDateKey()

  const { data: cached } = await supabaseServer
    .from('morning_summaries')
    .select('summary, generated_date')
    .eq('user_id', userId)
    .maybeSingle()

  if (cached?.generated_date === today && cached.summary) {
    return cached.summary
  }

  try {
    const summary = await generateSummaryText(userId, name, accessToken)
    await supabaseServer
      .from('morning_summaries')
      .upsert({ user_id: userId, summary, generated_date: today, updated_at: new Date().toISOString() })
    return summary
  } catch {
    return cached?.summary || "Here's your day - check the sections below for today's assignments and events."
  }
}
