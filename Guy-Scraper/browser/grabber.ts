import { ScraperLayoutError, SessionExpiredError } from '../errors'
import { scrapeSnapshot } from '../scrapeSnapshot'
import { buildGradesTsv } from '../tsv'
import { GRADES_MESSAGE, readReceivedMessage } from './messages'
import { createPageClient } from './pageClient'

// Runs inside the person's own Schoology tab when they click the Synergy bookmark. It reads their grades with the login that
// tab already has, then hands them to the Synergy tab. Nothing is uploaded: the grades go from this browser to this browser.

declare const __SCHOOLOGY_ORIGIN__: string

const HOST_ID = 'synergy-grabber'
const SEND_EVERY_MS = 700
const GIVE_UP_AFTER_MS = 25_000

// Where this script was loaded from is where Synergy lives.
const APP_ORIGIN = (() => {
  try {
    return new URL((document.currentScript as HTMLScriptElement).src).origin
  } catch {
    return ''
  }
})()

const CSS = `
  .box { font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #161a2e; background: #fff; border: 1px solid #d5d9e6;
         border-radius: 16px; box-shadow: 0 8px 30px rgba(22,26,46,.25); width: 320px; max-width: calc(100vw - 32px); padding: 16px 18px; }
  .title { font-weight: 700; font-size: 15px; color: #2536b8; margin-bottom: 6px; }
  .text { margin: 0 0 12px; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  button { font: inherit; font-weight: 600; height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer; border: 1px solid #d5d9e6; background: #fff; color: #161a2e; }
  button.primary { background: #3347e6; border-color: #3347e6; color: #fff; }
  .problem { color: #b42318; }
`

type Action = { label: string; primary?: boolean; run: () => void }

function createPanel() {
  document.getElementById(HOST_ID)?.remove()
  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647'
  const root = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = CSS
  const box = document.createElement('div')
  box.className = 'box'
  box.setAttribute('role', 'status')
  const title = document.createElement('div')
  title.className = 'title'
  title.textContent = 'Synergy'
  const text = document.createElement('p')
  text.className = 'text'
  const buttons = document.createElement('div')
  buttons.className = 'buttons'
  box.append(title, text, buttons)
  root.append(style, box)
  document.documentElement.append(host)

  const show = (message: string, actions: Action[], isProblem = false) => {
    text.textContent = message
    text.className = isProblem ? 'text problem' : 'text'
    buttons.replaceChildren(
      ...[...actions, { label: 'Close', run: () => host.remove() }].map(action => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = action.label
        if (action.primary) button.className = 'primary'
        button.addEventListener('click', action.run)
        return button
      }),
    )
  }
  return { show }
}

function download(tsv: string) {
  const url = URL.createObjectURL(new Blob([tsv], { type: 'text/tab-separated-values' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'grades.tsv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function main() {
  const panel = createPanel()
  if (location.origin !== __SCHOOLOGY_ORIGIN__) {
    panel.show(`This only works on your Schoology page (${__SCHOOLOGY_ORIGIN__}). Open it, sign in, and click the bookmark there.`, [], true)
    return
  }

  panel.show('Reading your grades from Schoology. This takes a few seconds…', [])
  try {
    const { text: tsv, classes, assignments } = buildGradesTsv(await scrapeSnapshot(createPageClient()), new Date())
    if (classes === 0) {
      panel.show('No classes were found. Make sure you are signed in to Schoology, then click the bookmark again.', [], true)
      return
    }

    const ready = `Found ${classes} ${classes === 1 ? 'class' : 'classes'} and ${assignments} ${assignments === 1 ? 'assignment' : 'assignments'}.`
    const actions: Action[] = [
      { label: 'Send to Synergy', primary: true, run: () => send(tsv, ready, actions) },
      { label: 'Download file', run: () => download(tsv) },
    ]
    panel.show(`${ready} Press Send to open Synergy with your grades. Nothing is uploaded to a server.`, actions)

    function send(data: string, summary: string, again: Action[]) {
      if (!APP_ORIGIN) {
        panel.show("Synergy's address could not be found. Use Download file, then import it on the website.", again, true)
        return
      }
      const synergyTab = window.open(`${APP_ORIGIN}/app`, 'synergy')
      if (!synergyTab) {
        panel.show('Your browser blocked the Synergy tab. Allow pop-ups for this page, then press Send again.', again, true)
        return
      }
      panel.show('Sending to Synergy…', [])

      let finished = false
      const stop = () => {
        finished = true
        clearInterval(timer)
        clearTimeout(giveUp)
        window.removeEventListener('message', onMessage)
      }
      // The Synergy tab may still be loading, so the grades are offered again until it says it has them.
      const timer = setInterval(() => {
        try {
          synergyTab.postMessage({ type: GRADES_MESSAGE, version: 1, tsv: data }, APP_ORIGIN)
        } catch {
          // The tab isn't ready for messages yet: try again next time.
        }
      }, SEND_EVERY_MS)
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== APP_ORIGIN || event.source !== synergyTab) return
        const reply = readReceivedMessage(event.data)
        if (!reply) return
        stop()
        if (reply.ok) panel.show(`${summary} Sent. Switch to the Synergy tab to see them.`, [])
        else panel.show(reply.message ?? 'Synergy could not read the grades.', again, true)
      }
      window.addEventListener('message', onMessage)
      const giveUp = setTimeout(() => {
        if (finished) return
        stop()
        panel.show("Couldn't reach the Synergy tab. Use Download file, then import it on the Synergy website.", again, true)
      }, GIVE_UP_AFTER_MS)
    }
  } catch (err) {
    if (err instanceof SessionExpiredError) panel.show("Schoology says you're signed out. Sign in, then click the bookmark again.", [], true)
    else if (err instanceof ScraperLayoutError) panel.show("Schoology's pages look different than expected, so nothing was read. Synergy may need an update.", [], true)
    else panel.show("Couldn't read Schoology. Check your internet connection and try again.", [], true)
  }
}

void main()
