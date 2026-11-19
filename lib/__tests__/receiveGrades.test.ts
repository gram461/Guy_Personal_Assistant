import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { GRADES_MESSAGE, RECEIVED_MESSAGE } from '@/Guy-Scraper/browser/messages'
import { createGradesReceiver } from '@/components/synergy/receiveGrades'
import { grabberLink } from '@/components/synergy/grabberLink'

const SCHOOL = 'https://fuhsd.schoology.com'
const message = (tsv: string, origin = SCHOOL) => ({ origin, data: { type: GRADES_MESSAGE, version: 1, tsv }, source: { postMessage: vi.fn() } })

function setup(result: { ok: true; classes: number; assignments: number } | { ok: false; message?: string } = { ok: true, classes: 2, assignments: 9 }) {
  const importGrades = vi.fn(async () => result)
  const onImported = vi.fn()
  return { importGrades, onImported, receive: createGradesReceiver({ importGrades, onImported, trustedOrigin: SCHOOL }) }
}

describe('receiving grades from the Schoology tab', () => {
  it('loads them, tells the screens, and answers the sender', async () => {
    const t = setup()
    const event = message('tsv-1')
    await t.receive(event)
    expect(t.importGrades).toHaveBeenCalledWith('tsv-1')
    expect(t.onImported).toHaveBeenCalledWith('Loaded 2 classes and 9 assignments from Schoology.')
    expect(event.source.postMessage).toHaveBeenCalledWith({ type: RECEIVED_MESSAGE, ok: true, classes: 2, assignments: 9 }, SCHOOL)
  })

  it('ignores anyone who is not the Schoology page, and messages that are not grades', async () => {
    const t = setup()
    for (const event of [message('x', 'https://evil.example'), message('x', 'https://fuhsd.schoology.com.evil.example'), { origin: SCHOOL, data: { type: 'other' }, source: { postMessage: vi.fn() } }, { origin: SCHOOL, data: 'text', source: null }]) {
      await t.receive(event)
    }
    expect(t.importGrades).not.toHaveBeenCalled()
    expect(t.onImported).not.toHaveBeenCalled()
  })

  it('loads the same grades once even when the helper keeps repeating them, and answers every copy', async () => {
    const t = setup()
    const events = [message('same'), message('same'), message('same')]
    await Promise.all(events.map(e => t.receive(e)))
    expect(t.importGrades).toHaveBeenCalledTimes(1)
    expect(t.onImported).toHaveBeenCalledTimes(1)
    for (const e of events) expect(e.source.postMessage).toHaveBeenCalledTimes(1)
  })

  it('loads newer grades when different ones arrive', async () => {
    const t = setup()
    await t.receive(message('first'))
    await t.receive(message('second'))
    expect(t.importGrades).toHaveBeenCalledTimes(2)
  })

  it('tells the sender when the grades could not be read, and does not claim success', async () => {
    const t = setup({ ok: false, message: "That doesn't look like a grades file." })
    const event = message('bad')
    await t.receive(event)
    expect(t.onImported).not.toHaveBeenCalled()
    expect(event.source.postMessage).toHaveBeenCalledWith({ type: RECEIVED_MESSAGE, ok: false, message: "That doesn't look like a grades file." }, SCHOOL)
  })

  it('copes with a sender that cannot be answered', async () => {
    const t = setup()
    await expect(t.receive({ origin: SCHOOL, data: { type: GRADES_MESSAGE, version: 1, tsv: 'x' }, source: null })).resolves.toBeUndefined()
  })
})

describe('the bookmark', () => {
  const run = (url: string, origin: string) => {
    const code = decodeURIComponent(url.replace(/^javascript:/, ''))
    const appended: { src?: string; onerror?: () => void }[] = []
    const alerts: string[] = []
    const script: { src?: string; onerror?: () => void } = {}
    const sandbox = {
      location: { origin },
      alert: (text: string) => alerts.push(text),
      document: { createElement: () => script, documentElement: { appendChild: (el: typeof script) => appended.push(el) } },
      Date,
    }
    vm.runInNewContext(code, sandbox)
    return { appended, alerts, script }
  }

  const url = grabberLink('https://synergy.example', SCHOOL)

  it('is a javascript link', () => expect(url.startsWith('javascript:')).toBe(true))

  it('on the Schoology page, loads the helper from Synergy’s own address', () => {
    const { appended, alerts } = run(url, SCHOOL)
    expect(alerts).toEqual([])
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toMatch(/^https:\/\/synergy\.example\/synergy-grabber\.js\?\d+$/)
  })

  it('anywhere else, loads nothing and explains what to do', () => {
    for (const origin of ['https://synergy.example', 'https://evil.example', 'https://fuhsd.schoology.com.evil.example']) {
      const { appended, alerts } = run(url, origin)
      expect(appended).toHaveLength(0)
      expect(alerts[0]).toContain('Open your Schoology page')
    }
  })

  it('says what to do instead when the helper cannot load', () => {
    const { script, alerts } = run(url, SCHOOL)
    script.onerror?.()
    expect(alerts[0]).toContain('desktop app')
  })
})
