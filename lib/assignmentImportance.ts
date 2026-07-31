import { daysUntil } from './summaryFilters'
import type { SchoologyEvent } from './schoology'

export type ImportantAssignment = { title: string; date: string; reason: string }

export async function classifyImportantAssignments(assignments: SchoologyEvent[]): Promise<ImportantAssignment[]> {
  const candidates = assignments.filter(a => {
    const days = daysUntil(a.date)
    return days >= 0 && days <= 3
  })

  if (candidates.length === 0) return []

  try {
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
        messages: [{
          role: 'user',
          content: `Here are a student's upcoming assignments/events:\n\n${candidates.map((c, i) => `${i}. "${c.title}" — due in ${daysUntil(c.date)} day(s). Description: ${c.description || '(none)'}`).join('\n')}\n\nWhich of these are high-stakes (tests, exams, quizzes, major projects, big due dates) as opposed to routine homework or minor events? Respond with ONLY a JSON array (no other text) of objects like [{"index": 0, "reason": "short reason"}] for the high-stakes ones. If none are high-stakes, respond with [].`,
        }],
      }),
    })

    if (!res.ok) return []

    const data = await res.json()
    const rawText = data.content?.[0]?.text?.trim() || '[]'
    const text = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const flagged: { index: number; reason: string }[] = JSON.parse(text)

    return flagged
      .filter(f => candidates[f.index])
      .map(f => ({ title: candidates[f.index].title, date: candidates[f.index].date, reason: f.reason }))
  } catch {
    return []
  }
}
