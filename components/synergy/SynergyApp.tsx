'use client'

import { useEffect, useState } from 'react'
import { App } from '@/Guy-Scraper/desktop/ui/App'
import '@/Guy-Scraper/desktop/ui/styles.css'
import { createGradesReceiver } from './receiveGrades'
import { webBridge } from './webBridge'

// The same screens the desktop app shows, running in the browser with the website's own bridge in place of the desktop program.
export default function SynergyApp() {
  const [ready] = useState(() => {
    window.synergy = webBridge
    return true
  })

  // Grades sent from the person's own Schoology tab by the "Get my grades" bookmark.
  useEffect(() => {
    const receive = createGradesReceiver({
      importGrades: text => webBridge.importGrades!(text),
      onImported: message => window.dispatchEvent(new CustomEvent('synergy:grades-changed', { detail: { message } })),
    })
    const listener = (event: MessageEvent) => void receive(event)
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [])

  return ready ? <App /> : null
}
